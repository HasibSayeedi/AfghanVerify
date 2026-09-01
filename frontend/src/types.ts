export interface University {
  id: string;
  nameEnglish: string;
  nameDari: string;
  namePashto: string;
  code: string;
  logoUrl: string;
  primaryColor: string;
  faculties: Faculty[];
}

export interface Faculty { id: string; name: string; departments: Department[]; }
export interface Department { id: string; name: string; }

export interface Grade {
  subjectName: string;
  semesterNumber: number;
  score: number;
  creditHours: string;
}

interface CertificateSummary {
  detailsAvailable: boolean;
  studentName: string | null;
  fatherName: string | null;
  tazkiraNumber: string | null;
  profilePicture: string | null;
  university: University;
  faculty: string | null;
  department: string | null;
  graduationYear: number | null;
  gpa: string | null;
  documentType: string | null;
  status: string;
  securitySignature: string;
  signatureVersion: number;
  signingKeyId: string;
  signatureValid: boolean;
  issuedAt: string;
  verificationCode: string;
  diplomaFileUrl?: string;
  transcriptFileUrl?: string;
  issuanceSystem: string | null;
  legacyMaktoubNumber?: string;
  remarks?: string;
  supersedesVerificationCode?: string;
  replacementVerificationCode?: string;
  transcript: Grade[];
}

export interface VerifiedCertificateData extends CertificateSummary {
  detailsAvailable: true;
  studentName: string;
  fatherName: string;
  tazkiraNumber: string;
  profilePicture: string;
  faculty: string;
  department: string;
  graduationYear: number;
  gpa: string;
  documentType: string;
  issuanceSystem: string;
}

export interface RestrictedCertificateData extends CertificateSummary {
  detailsAvailable: false;
}

export type CertificateData = VerifiedCertificateData | RestrictedCertificateData;

export interface AuthSession {
  token: string;
  expiresAt: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'Ministry' | 'University' | 'SUPER_ADMIN' | 'UNIVERSITY_ADMIN';
  universityId?: string;
}
