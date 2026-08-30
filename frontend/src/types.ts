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

export interface CertificateData {
  studentName: string;
  fatherName: string;
  tazkiraNumber: string;
  profilePicture: string;
  university: University;
  faculty: string;
  department: string;
  graduationYear: number;
  gpa: string;
  documentType: string;
  status: string;
  securitySignature: string;
  signatureVersion: number;
  signatureValid: boolean;
  issuedAt: string;
  verificationCode: string;
  diplomaFileUrl?: string;
  transcriptFileUrl?: string;
  issuanceSystem: string;
  legacyMaktoubNumber?: string;
  remarks?: string;
  transcript: Grade[];
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'Ministry' | 'University' | 'SUPER_ADMIN' | 'UNIVERSITY_ADMIN';
  universityId?: string;
}
