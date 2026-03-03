import { Worker, type Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { PDFDocument, StandardFonts, rgb, type Color } from 'pdf-lib';
import pino from 'pino';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = pino({ name: 'report-worker' });
const prisma = new PrismaClient();

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const REPORTS_DIR = process.env.REPORTS_DIR ?? './reports';

async function processReport(
  job: Job<{ sessionId: string; scoreCardId: string }>,
): Promise<void> {
  const { sessionId, scoreCardId } = job.data;
  logger.info({ sessionId, scoreCardId }, 'Generating report PDF');

  // Load all data
  const session = await prisma.interviewSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      scenario: true,
      candidate: true,
      turns: { orderBy: { index: 'asc' } },
      scoreCard: true,
    },
  });

  if (!session.scoreCard) {
    throw new Error('ScoreCard not found');
  }

  const scoreCard = session.scoreCard;
  const criterionScores = scoreCard.criterionScores as Array<{
    criterionName: string;
    score: number;
    maxScore: number;
    evidence: string;
    reasoning: string;
  }>;

  // ─── Build PDF ──────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const titleSize = 16;
  const headerSize = 12;
  const margin = 50;

  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    options: { font?: typeof font; size?: number; color?: Color; x?: number } = {},
  ) => {
    const f = options.font ?? font;
    const s = options.size ?? fontSize;
    const x = options.x ?? margin;

    // Simple word wrap
    const maxWidth = page.getWidth() - 2 * margin;
    const words = text.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = f.widthOfTextAtSize(testLine, s);
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x, y, font: f, size: s, color: options.color });
        y -= s + 4;
        line = word;

        if (y < margin) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = page.getHeight() - margin;
        }
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x, y, font: f, size: s, color: options.color });
      y -= s + 4;
    }
    y -= 4; // extra spacing after paragraph
  };

  const drawSeparator = () => {
    y -= 5;
    page.drawLine({
      start: { x: margin, y },
      end: { x: page.getWidth() - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
  };

  // ─── Title ──────────────────────────────────────────────
  drawText('SmartHirink - Interview Assessment Report', {
    font: fontBold,
    size: titleSize,
    color: rgb(0.1, 0.1, 0.5),
  });
  drawSeparator();

  // ─── Session Info ───────────────────────────────────────
  drawText('Interview Details', { font: fontBold, size: headerSize });
  drawText(`Candidate: ${session.candidate.fullName} (${session.candidate.email})`);
  drawText(`Position: ${session.scenario.position} (${session.scenario.level})`);
  drawText(`Scenario: ${session.scenario.title}`);
  drawText(`Date: ${session.startedAt?.toISOString().split('T')[0] ?? 'N/A'}`);
  drawText(`Duration: ${session.turns.length} turns`);
  drawSeparator();

  // ─── Overall Score ──────────────────────────────────────
  drawText('Overall Assessment', { font: fontBold, size: headerSize });
  drawText(
    `Score: ${scoreCard.overallScore.toFixed(1)} / ${scoreCard.maxPossibleScore.toFixed(1)}`,
    { font: fontBold, size: 14, color: rgb(0, 0.4, 0) },
  );
  drawText(`Recommendation: ${scoreCard.recommendation}`, {
    font: fontBold,
    color: rgb(0.2, 0.2, 0.6),
  });
  drawSeparator();

  // ─── Criterion Scores ──────────────────────────────────
  drawText('Criteria Breakdown', { font: fontBold, size: headerSize });
  for (const cs of criterionScores) {
    drawText(`${cs.criterionName}: ${cs.score}/${cs.maxScore}`, { font: fontBold });
    drawText(`Evidence: "${cs.evidence}"`);
    drawText(`Reasoning: ${cs.reasoning}`);
    y -= 4;
  }
  drawSeparator();

  // ─── Strengths & Weaknesses ────────────────────────────
  drawText('Strengths', { font: fontBold, size: headerSize });
  for (const s of scoreCard.strengths) {
    drawText(`• ${s}`);
  }
  drawSeparator();

  drawText('Areas for Improvement', { font: fontBold, size: headerSize });
  for (const w of scoreCard.weaknesses) {
    drawText(`• ${w}`);
  }
  drawSeparator();

  // ─── Transcript ─────────────────────────────────────────
  drawText('Interview Transcript', { font: fontBold, size: headerSize });
  for (const turn of session.turns) {
    const label = turn.speakerRole === 'AI' ? 'Interviewer' : 'Candidate';
    drawText(`[${label}]: ${turn.transcript}`);
  }

  // ─── Disclaimer ─────────────────────────────────────────
  drawSeparator();
  drawText(
    'Disclaimer: This report was generated by an AI system. Scores and assessments are for reference only. Final hiring decisions should involve human review.',
    { size: 8, color: rgb(0.5, 0.5, 0.5) },
  );

  // ─── Save PDF ───────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const filename = `report_${sessionId}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);
  await fs.writeFile(filePath, pdfBytes);

  // Save report record
  await prisma.report.create({
    data: {
      sessionId,
      scoreCardId,
      pdfUrl: `/reports/${filename}`,
      generatedAt: new Date(),
    },
  });

  logger.info({ sessionId, filePath }, 'Report PDF generated');
}

export function startReportWorker(): Worker {
  const worker = new Worker('report', processReport, {
    connection: redis as any,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Report job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Report job failed');
  });

  return worker;
}
