'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  Globe,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Github,
  ExternalLink,
  Calendar,
  Clock,
  Languages,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { LoadingSkeleton } from '@/components/skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string;
  highlights: string[];
}

interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string | null;
  endDate: string | null;
  gpa: string | null;
  honors: string | null;
}

interface Certification {
  name: string;
  issuer: string;
  date: string | null;
  expiryDate: string | null;
  credentialId: string | null;
}

interface Project {
  name: string;
  description: string;
  technologies: string[];
  url: string | null;
}

export default function CandidateDetailPage() {
  const params = useParams();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    api
      .getCandidate(id)
      .then(setCandidate)
      .catch((err) => toast('error', err.message || 'Failed to load candidate'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (!candidate) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-muted-foreground">Candidate not found.</p>
      </div>
    );
  }

  const parsed = candidate.parsedData as {
    workExperience?: WorkExperience[];
    education?: Education[];
    certifications?: Certification[];
    projects?: Project[];
    languages?: string[];
  } | null;

  const workExperience = parsed?.workExperience || [];
  const education = parsed?.education || [];
  const certifications = parsed?.certifications || [];
  const projects = parsed?.projects || [];
  const languages = parsed?.languages || [];

  return (
    <div className="container max-w-4xl py-8">
      {/* Back navigation */}
      <Link
        href="/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Candidates
      </Link>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{candidate.fullName}</h1>
              {candidate.headline && (
                <p className="text-muted-foreground">{candidate.headline}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-muted-foreground">
                {candidate.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {candidate.phone}
                  </span>
                )}
                {candidate.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {candidate.location}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {candidate.linkedinUrl && (
                  <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Linkedin className="mr-1 h-3.5 w-3.5" /> LinkedIn
                    </Button>
                  </a>
                )}
                {candidate.githubUrl && (
                  <a href={candidate.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Github className="mr-1 h-3.5 w-3.5" /> GitHub
                    </Button>
                  </a>
                )}
                {candidate.portfolioUrl && (
                  <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Globe className="mr-1 h-3.5 w-3.5" /> Portfolio
                    </Button>
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary" className="text-sm">
                {candidate.experienceYears} yr{candidate.experienceYears !== 1 ? 's' : ''} experience
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Summary */}
      {candidate.summary && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Professional Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{candidate.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      {candidate.skills?.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill: string, i: number) => (
                <Badge key={i} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Experience */}
      {workExperience.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" /> Work Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {workExperience.map((job, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-6" />}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {job.startDate} — {job.endDate || 'Present'}
                      {job.location && (
                        <>
                          <span className="text-border">|</span>
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </>
                      )}
                    </div>
                  </div>
                  {job.description && (
                    <p className="text-sm text-muted-foreground">{job.description}</p>
                  )}
                  {job.highlights?.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-1">
                      {job.highlights.map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" /> Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {education.map((edu, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-6" />}
                <div className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <h3 className="font-semibold">{edu.degree} in {edu.field}</h3>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                    </div>
                    {(edu.startDate || edu.endDate) && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {edu.startDate && edu.endDate
                          ? `${edu.startDate} — ${edu.endDate}`
                          : edu.endDate || edu.startDate}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {edu.gpa && <span>GPA: {edu.gpa}</span>}
                    {edu.honors && <span>{edu.honors}</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" /> Certifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {certifications.map((cert, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{cert.name}</h3>
                  <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {cert.date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Issued {cert.date}
                      </span>
                    )}
                    {cert.expiryDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expires {cert.expiryDate}
                      </span>
                    )}
                    {cert.credentialId && (
                      <span>ID: {cert.credentialId}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderGit2 className="h-5 w-5" /> Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {projects.map((proj, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-5" />}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{proj.name}</h3>
                    {proj.url && (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{proj.description}</p>
                  {proj.technologies?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {proj.technologies.map((tech, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Languages className="h-5 w-5" /> Languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang, i) => (
                <Badge key={i} variant="secondary">
                  {lang}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
