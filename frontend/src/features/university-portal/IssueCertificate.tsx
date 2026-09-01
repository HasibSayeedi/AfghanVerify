import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, getApiError, publicVerifyBaseUrl, readSession } from '../../lib/api';
import type { Grade, University } from '../../types';
import IssuedRecords, { type IssuedCredential } from './IssuedRecords';
import { downloadTranscriptTemplate, importTranscript } from './transcriptImport';

const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50';
const label = 'block text-xs font-bold uppercase tracking-wide text-slate-500';
const validationInput = (error?: string) => `${input} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`;
const issuanceInput = (error?: string) => `mt-2 w-full rounded-xl border bg-white/10 px-4 py-3 text-white outline-none placeholder:text-emerald-200/60 ${error ? 'border-red-300 focus:border-red-200' : 'border-white/20 focus:border-emerald-300'}`;
const personNamePattern = /^[\p{Script=Latin}\p{Script=Arabic}\p{M} ]*$/u;
const lettersMarksAndSpacesPattern = /^[\p{L}\p{M} ]*$/u;
const documentTypes = ['Both', 'DiplomaOnly', 'TranscriptOnly'] as const;
type StudentField = 'firstName' | 'lastName' | 'fatherName' | 'tazkiraNumber' | 'gpa' | 'graduationYear' | 'profilePicture' | 'documentType' | 'universityId' | 'facultyId' | 'departmentId' | 'diplomaFileUrl' | 'transcriptFileUrl' | 'supersedesVerificationCode';
type CourseField = 'subjectName' | 'semesterNumber' | 'score' | 'creditHours';
type WorkspaceTab = 'issue' | 'records';

const emptyCredentialForm = (universityId = '') => ({ firstName:'', lastName:'', fatherName:'', tazkiraNumber:'', universityId, facultyId:'', departmentId:'', graduationYear:new Date().getFullYear(), documentType:'Both', gpa:'', profilePicture:'', issuanceSystem:'DigitalFirst', legacyMaktoubNumber:'', diplomaFileUrl:'', transcriptFileUrl:'', supersedesVerificationCode:'' });

const nameError = (value: string, displayName: string) => !value.trim()
  ? `${displayName} is required.`
  : !personNamePattern.test(value) || !lettersMarksAndSpacesPattern.test(value) || !Array.from(value).some(character=>/\p{L}/u.test(character))
    ? `${displayName} may contain only Latin or Arabic-script letters and spaces.`
    : undefined;
const gpaError = (value: string) => {
  const numericValue = Number(value);
  if (!value.trim()) return 'GPA is required.';
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(numericValue)) return 'GPA must be a number with no more than two decimal places.';
  return numericValue < 1 || numericValue > 4 ? 'GPA must be between 1.00 and 4.00.' : undefined;
};
const tazkiraError = (value: string) => !value.trim() ? 'Tazkira number is required.' : !/^[0-9]{13}$/.test(value) ? 'Tazkira number must contain exactly 13 digits.' : undefined;
const graduationYearError = (value: number) => Number.isInteger(value) && value >= 2000 && value <= 2045 ? undefined : 'Graduation year must be a four-digit year between 2000 and 2045.';
const portraitUrlError = (value: string) => {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value);
    return !['http:', 'https:'].includes(url.protocol) || !/\.(?:jpe?g|png)$/i.test(url.pathname)
      ? 'Portrait URL must be an HTTP(S) image ending in .jpg, .jpeg, or .png.'
      : undefined;
  } catch { return 'Enter a complete portrait URL, such as https://example.com/photo.jpg.'; }
};
const documentUrlError = (value: string, label: string, required: boolean) => {
  if (!value.trim()) return required ? `${label} URL is required for the selected document type.` : undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? undefined : `${label} URL must use HTTP or HTTPS.`;
  } catch { return `Enter a valid ${label.toLowerCase()} URL, such as https://storage.com/document.pdf.`; }
};
const replacementCodeError=(value:string)=>!value.trim()||/^[A-Za-z0-9]{2,4}-(?:\d{9}|[A-Fa-f0-9]{5})$/.test(value.trim())
  ?undefined:'Enter a valid credential code to replace, e.g. KU-491029481.';

export default function IssueCertificate() {
  const session = readSession();
  const [universities, setUniversities] = useState<University[]>([]);
  const [subjects, setSubjects] = useState<Grade[]>([]);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string; code?: string } | null>(null);
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false); const [importing, setImporting] = useState(false);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => emptyCredentialForm(session?.universityId));
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('issue');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [studentErrors, setStudentErrors] = useState<Partial<Record<StudentField, string>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [course, setCourse] = useState({ subjectName:'', semesterNumber:'', score:'', creditHours:'' });
  const [courseErrors, setCourseErrors] = useState<Partial<Record<CourseField, string>>>({});

  useEffect(() => {
    void api.get<University[]>('/api/universities').then(({ data }) => {
      setUniversities(data);
      setForm(current => {
        const university = data.find(item => item.id === (session?.universityId || current.universityId)) ?? (!session?.universityId && data.length === 1 ? data[0] : undefined);
        const faculty = university?.faculties[0];
        return university ? { ...current, universityId:university.id, facultyId:faculty?.id??'', departmentId:faculty?.departments[0]?.id??'' } : current;
      });
    }).catch(() => setNotice({ kind:'error', text:'Could not load accredited universities.' }));
  }, [session?.universityId]);

  const selectedUniversity = useMemo(() => universities.find(item => item.id === form.universityId), [universities, form.universityId]);
  const selectedFaculty = useMemo(() => selectedUniversity?.faculties.find(item => item.id === form.facultyId), [selectedUniversity, form.facultyId]);
  const semesterLimit = /medicine|medical|stomatology/i.test(selectedFaculty?.name ?? '') ? 14 : 8;
  const requiresDiplomaUrl = form.documentType === 'Both' || form.documentType === 'DiplomaOnly';
  const requiresTranscriptUrl = form.documentType === 'Both' || form.documentType === 'TranscriptOnly';
  const update = (key: string, value: string | number) => setForm(current => ({ ...current, [key]:value }));
  const setStudentError = (key: StudentField, message?: string) => setStudentErrors(current => ({ ...current, [key]:message }));
  const validateName = (key: 'firstName' | 'lastName' | 'fatherName', value: string, displayName: string) => {
    const message = nameError(value, displayName);
    setStudentError(key, message);
    return !message;
  };
  const updateName = (key: 'firstName' | 'lastName' | 'fatherName', value: string, displayName: string) => {
    if (!personNamePattern.test(value) || !lettersMarksAndSpacesPattern.test(value)) {
      setStudentError(key, `${displayName} may contain only Latin or Arabic-script letters and spaces.`);
      return;
    }
    update(key, value);
    setStudentError(key, nameError(value, displayName));
  };
  const validateGpa = (value: string) => {
    const message = gpaError(value);
    setStudentError('gpa', message);
    return !message;
  };
  const updateUniversity = (universityId: string) => { const university=universities.find(item=>item.id===universityId);const faculty=university?.faculties[0];setForm(current=>({...current,universityId,facultyId:faculty?.id??'',departmentId:faculty?.departments[0]?.id??''}));setStudentErrors(current=>({...current,universityId:undefined,facultyId:undefined,departmentId:undefined})); };
  const updateFaculty = (facultyId: string) => { const faculty=selectedUniversity?.faculties.find(item=>item.id===facultyId);setForm(current=>({...current,facultyId,departmentId:faculty?.departments[0]?.id??''}));setStudentErrors(current=>({...current,facultyId:undefined,departmentId:undefined})); };
  const getCourseError = (key: CourseField, value: string) => {
    if (key === 'subjectName') return value.trim() ? undefined : 'Course name is required.';
    if (key === 'semesterNumber') return !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > semesterLimit ? `Semester must be a whole number between 1 and ${semesterLimit}.` : undefined;
    if (key === 'score') return !/^\d+$/.test(value) || Number(value) < 0 || Number(value) > 100 ? 'Score must be a whole number between 0 and 100.' : undefined;
    return !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 6 ? 'Credit hours must be a whole number between 1 and 6.' : undefined;
  };
  const courseIsValid = (Object.keys(course) as CourseField[]).every(key=>!getCourseError(key,course[key]));
  const hasCourseDraft = Object.values(course).some(value=>value.trim());
  const formIsValid = !nameError(form.firstName,'First name') && !nameError(form.lastName,'Last name') && !nameError(form.fatherName,"Father's name")
    && !tazkiraError(form.tazkiraNumber) && !gpaError(form.gpa) && !graduationYearError(Number(form.graduationYear))
    && !portraitUrlError(form.profilePicture) && documentTypes.includes(form.documentType as typeof documentTypes[number])
    && Boolean(form.universityId && form.facultyId && form.departmentId) && (!hasCourseDraft || courseIsValid)
    && !documentUrlError(form.diplomaFileUrl,'Diploma',requiresDiplomaUrl) && !documentUrlError(form.transcriptFileUrl,'Transcript',requiresTranscriptUrl)
    && !replacementCodeError(form.supersedesVerificationCode)
    && (form.issuanceSystem !== 'Legacy' || Boolean(form.legacyMaktoubNumber.trim()));
  const updateCourse = (key: CourseField, value: string) => {
    setCourse(current=>({...current,[key]:value}));
    setCourseErrors(current=>({...current,[key]:getCourseError(key,value)}));
  };
  const addCourse = () => {
    const subjectName=course.subjectName.trim();const semesterNumber=Number(course.semesterNumber);const score=Number(course.score);const creditHours=Number(course.creditHours);
    const errors: Partial<Record<CourseField,string>> = {
      subjectName:getCourseError('subjectName',course.subjectName),semesterNumber:getCourseError('semesterNumber',course.semesterNumber),
      score:getCourseError('score',course.score),creditHours:getCourseError('creditHours',course.creditHours)
    };
    setCourseErrors(errors);
    if(Object.values(errors).some(Boolean))return;
    setSubjects(current=>[...current,{subjectName,semesterNumber,score,creditHours:String(creditHours)}]);setCourse({subjectName:'',semesterNumber:'',score:'',creditHours:''});setCourseErrors({});
  };

  const uploadTranscript = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0]; event.target.value=''; if(!file)return;
    setImporting(true); setImportMessage(null);
    try { const imported=await importTranscript(file);const invalidSemester=imported.find(item=>item.semesterNumber>semesterLimit);if(invalidSemester)throw new Error(`Semester ${invalidSemester.semesterNumber} exceeds the ${semesterLimit}-semester limit for the selected faculty.`);setSubjects(imported);setImportMessage({kind:'ok',text:`Imported ${imported.length} validated course${imported.length===1?'':'s'} from ${file.name}.`}); }
    catch(error){setImportMessage({kind:'error',text:error instanceof Error?error.message:'The transcript file could not be imported.'});}
    finally{setImporting(false);}
  };

  const downloadTemplate = async (format: 'xlsx'|'csv') => {
    try { await downloadTranscriptTemplate(format); }
    catch { setImportMessage({ kind:'error', text:`The ${format.toUpperCase()} template could not be generated.` }); }
  };

  const startNewCredential = () => {
    const university = universities.find(item => item.id === session?.universityId) ?? universities[0];
    const faculty = university?.faculties[0];
    setForm({ ...emptyCredentialForm(university?.id ?? session?.universityId ?? ''), facultyId:faculty?.id ?? '', departmentId:faculty?.departments[0]?.id ?? '' });
    setSubjects([]); setCourse({subjectName:'',semesterNumber:'',score:'',creditHours:''}); setCourseErrors({}); setStudentErrors({});
    setSubmitAttempted(false); setEditingCode(null); setImportMessage(null); setNotice(null); setWorkspaceTab('issue');
  };

  const editPendingCredential = (record: IssuedCredential) => {
    setForm({
      firstName:record.firstName, lastName:record.lastName, fatherName:record.fatherName, tazkiraNumber:record.tazkiraNumber,
      universityId:record.universityId, facultyId:record.facultyId, departmentId:record.departmentId,
      graduationYear:record.graduationYear, documentType:record.documentType, gpa:record.gpa,
      profilePicture:record.profilePicture ?? '', issuanceSystem:record.issuanceSystem,
      legacyMaktoubNumber:record.legacyMaktoubNumber ?? '', diplomaFileUrl:record.diplomaFileUrl ?? '',
      transcriptFileUrl:record.transcriptFileUrl ?? '', supersedesVerificationCode:record.supersedesVerificationCode ?? ''
    });
    setSubjects(record.subjects ?? []); setCourse({subjectName:'',semesterNumber:'',score:'',creditHours:''}); setCourseErrors({}); setStudentErrors({});
    setSubmitAttempted(false); setEditingCode(record.verificationCode); setImportMessage(null); setNotice(null); setWorkspaceTab('issue');
    requestAnimationFrame(() => window.scrollTo({top:0,behavior:'smooth'}));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice(null); setSubmitAttempted(true);
    const validationErrors: Partial<Record<StudentField,string>> = {
      firstName:nameError(form.firstName,'First name'),lastName:nameError(form.lastName,'Last name'),fatherName:nameError(form.fatherName,"Father's name"),
      tazkiraNumber:tazkiraError(form.tazkiraNumber),gpa:gpaError(form.gpa),
      graduationYear:graduationYearError(Number(form.graduationYear)),
      profilePicture:portraitUrlError(form.profilePicture),documentType:documentTypes.includes(form.documentType as typeof documentTypes[number])?undefined:'Select a valid document type.',
      universityId:form.universityId?undefined:'Select an accredited university.',facultyId:form.facultyId?undefined:'Select a faculty.',departmentId:form.departmentId?undefined:'Select a department.',
      diplomaFileUrl:documentUrlError(form.diplomaFileUrl,'Diploma',requiresDiplomaUrl),transcriptFileUrl:documentUrlError(form.transcriptFileUrl,'Transcript',requiresTranscriptUrl),
      supersedesVerificationCode:replacementCodeError(form.supersedesVerificationCode)
    };
    setStudentErrors(validationErrors);
    if(Object.values(validationErrors).some(Boolean))return;
    if(hasCourseDraft){
      const draftErrors: Partial<Record<CourseField,string>> = {subjectName:getCourseError('subjectName',course.subjectName),semesterNumber:getCourseError('semesterNumber',course.semesterNumber),score:getCourseError('score',course.score),creditHours:getCourseError('creditHours',course.creditHours)};
      setCourseErrors(draftErrors);if(Object.values(draftErrors).some(Boolean))return;
    }
    setLoading(true); const optional=(value:string)=>value.trim()||null;
    const payload={...form,firstName:form.firstName.trim(),lastName:form.lastName.trim(),fatherName:form.fatherName.trim(),tazkiraNumber:form.tazkiraNumber.trim(),gpa:form.gpa.trim(),profilePicture:optional(form.profilePicture),legacyMaktoubNumber:form.issuanceSystem==='Legacy'?optional(form.legacyMaktoubNumber):null,diplomaFileUrl:optional(form.diplomaFileUrl),transcriptFileUrl:optional(form.transcriptFileUrl),subjects};
    try {
      if(editingCode){
        const {data}=await api.put(`/api/certificates/${encodeURIComponent(editingCode)}/pending`,payload);
        setNotice({kind:'ok',text:data.message});setEditingCode(null);setImportMessage(null);setWorkspaceTab('records');
      }else{
        const {data}=await api.post('/api/certificates/issue',payload);setNotice({kind:'ok',text:data.message,code:data.verificationCode});setSubjects([]);setForm(current=>({...current,supersedesVerificationCode:''}));setImportMessage(null);
      }
      requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
    }
    catch(error){setNotice({kind:'error',text:getApiError(error,'The credential could not be issued.')});requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));}
    finally{setLoading(false);}
  };

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="mb-8"><div className="flex items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#02382c] shadow-sm"><Building2 className="h-9 w-9" strokeWidth={1.7} aria-hidden="true" /></span><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-700">University workspace</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Issue an academic credential</h1><p className="mt-2 text-slate-500">Create a signed record and submit it to the Ministry review queue.</p></div></div></div>
    <div className="mb-6 inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"><button type="button" onClick={startNewCredential} className={`min-h-11 flex-1 rounded-xl px-5 py-2.5 text-sm font-bold transition sm:flex-none ${workspaceTab==='issue'&&!editingCode?'bg-[#02382c] text-white shadow-sm':'text-slate-600 hover:bg-slate-50'}`}>Issue credential</button><button type="button" onClick={()=>{setNotice(null);setWorkspaceTab('records');}} className={`min-h-11 flex-1 rounded-xl px-5 py-2.5 text-sm font-bold transition sm:flex-none ${workspaceTab==='records'?'bg-[#02382c] text-white shadow-sm':'text-slate-600 hover:bg-slate-50'}`}>Issued records</button></div>
    {notice&&<div className={`mb-6 rounded-3xl border p-6 ${notice.kind==='ok'?'border-emerald-200 bg-emerald-50 text-emerald-950':'border-red-200 bg-red-50 text-red-800'}`}>{notice.code?<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start"><div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"><QRCodeSVG value={`${publicVerifyBaseUrl}/verify/${encodeURIComponent(notice.code)}`} size={152} level="H" includeMargin fgColor="#064e3b"/></div><div className="text-center sm:text-left"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Credential issued successfully</p><strong className="mt-2 block text-xl">{notice.text}</strong><p className="mt-4 text-sm text-emerald-800">Print this QR code on the diploma and transcript.</p><code className="mt-4 inline-block rounded-xl border border-emerald-200 bg-white px-4 py-3 text-2xl font-black tracking-[.18em]">{notice.code}</code><div><Link to={`/verify/${notice.code}`} className="mt-4 inline-block text-sm font-black text-emerald-800 underline">Open verification record →</Link></div></div></div>:<strong>{notice.text}</strong>}</div>}
    {workspaceTab==='records'?<IssuedRecords onEdit={editPendingCredential}/>:<>{editingCode&&<div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Correcting pending credential</p><code className="mt-1 block font-black">{editingCode}</code><p className="mt-1 text-xs text-amber-800">Saving will generate a new HMAC signature and retain the correction in the audit history.</p></div><button type="button" onClick={()=>setWorkspaceTab('records')} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold hover:bg-amber-100">Cancel editing</button></div>}<form noValidate onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm"><GraduationCap className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" /></span><h2 className="text-lg font-black">Student and institution</h2></div><div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className={label}>First name<input required type="text" placeholder="e.g., Ahmad" value={form.firstName} onChange={event=>updateName('firstName',event.target.value,'First name')} onBlur={()=>validateName('firstName',form.firstName,'First name')} aria-invalid={Boolean(studentErrors.firstName)} aria-describedby="first-name-error" className={validationInput(studentErrors.firstName)}/>{studentErrors.firstName&&<span id="first-name-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.firstName}</span>}</label>
          <label className={label}>Last name<input required type="text" placeholder="e.g., Rahimi" value={form.lastName} onChange={event=>updateName('lastName',event.target.value,'Last name')} onBlur={()=>validateName('lastName',form.lastName,'Last name')} aria-invalid={Boolean(studentErrors.lastName)} aria-describedby="last-name-error" className={validationInput(studentErrors.lastName)}/>{studentErrors.lastName&&<span id="last-name-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.lastName}</span>}</label>
          <label className={label}>Father's name<input required type="text" placeholder="e.g., Mohammad" value={form.fatherName} onChange={event=>updateName('fatherName',event.target.value,"Father's name")} onBlur={()=>validateName('fatherName',form.fatherName,"Father's name")} aria-invalid={Boolean(studentErrors.fatherName)} aria-describedby="father-name-error" className={validationInput(studentErrors.fatherName)}/>{studentErrors.fatherName&&<span id="father-name-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.fatherName}</span>}</label>
          <label className={label}>Tazkira number<input required type="text" inputMode="numeric" maxLength={13} placeholder="e.g., 1201040302145" value={form.tazkiraNumber} onChange={event=>{const digits=event.target.value.replace(/\D/g,'').slice(0,13);update('tazkiraNumber',digits);setStudentError('tazkiraNumber',tazkiraError(digits));}} onBlur={()=>setStudentError('tazkiraNumber',tazkiraError(form.tazkiraNumber))} aria-invalid={Boolean(studentErrors.tazkiraNumber)} aria-describedby={studentErrors.tazkiraNumber?'tazkira-error':undefined} className={validationInput(studentErrors.tazkiraNumber)}/>{studentErrors.tazkiraNumber&&<span id="tazkira-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.tazkiraNumber}</span>}</label>
          <label className={label}>GPA<input required type="number" inputMode="decimal" min="1" max="4" step="0.01" placeholder="0.00" value={form.gpa} onChange={event=>{update('gpa',event.target.value);validateGpa(event.target.value);}} onBlur={()=>validateGpa(form.gpa)} aria-invalid={Boolean(studentErrors.gpa)} aria-describedby="gpa-error" className={validationInput(studentErrors.gpa)}/>{studentErrors.gpa&&<span id="gpa-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.gpa}</span>}</label>
          <label className={label}>Accredited university<select required value={form.universityId} onChange={event=>updateUniversity(event.target.value)} aria-invalid={Boolean(studentErrors.universityId)} className={validationInput(studentErrors.universityId)}><option value="" disabled selected hidden>Select university</option>{universities.filter(item=>!session?.universityId||item.id===session.universityId).map(item=><option key={item.id} value={item.id}>{item.nameEnglish} ({item.code})</option>)}</select>{studentErrors.universityId&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.universityId}</span>}</label>
          <label className={label}>Faculty<select required disabled={!selectedUniversity} value={form.facultyId} onChange={event=>updateFaculty(event.target.value)} aria-invalid={Boolean(studentErrors.facultyId)} className={validationInput(studentErrors.facultyId)}><option value="" disabled selected hidden>Select faculty</option>{selectedUniversity?.faculties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{studentErrors.facultyId&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.facultyId}</span>}</label>
          <label className={label}>Department<select required disabled={!selectedFaculty} value={form.departmentId} onChange={event=>{update('departmentId',event.target.value);setStudentError('departmentId',event.target.value?undefined:'Select a department.');}} aria-invalid={Boolean(studentErrors.departmentId)} className={validationInput(studentErrors.departmentId)}><option value="" disabled selected hidden>Select department</option>{selectedFaculty?.departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{studentErrors.departmentId&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.departmentId}</span>}</label>
          <label className={label}>Graduation year<input required type="number" inputMode="numeric" min="2000" max="2045" step="1" placeholder="e.g., 2026" value={form.graduationYear} onChange={event=>{const value=Number(event.target.value);update('graduationYear',value);setStudentError('graduationYear',graduationYearError(value));}} aria-invalid={Boolean(studentErrors.graduationYear)} className={validationInput(studentErrors.graduationYear)}/>{studentErrors.graduationYear&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.graduationYear}</span>}</label>
          <label className={label}>Document type<select required value={form.documentType} onChange={event=>{const documentType=event.target.value;update('documentType',documentType);setStudentErrors(current=>({...current,documentType:documentTypes.includes(documentType as typeof documentTypes[number])?undefined:'Select a valid document type.',diplomaFileUrl:documentUrlError(form.diplomaFileUrl,'Diploma',documentType==='Both'||documentType==='DiplomaOnly'),transcriptFileUrl:documentUrlError(form.transcriptFileUrl,'Transcript',documentType==='Both'||documentType==='TranscriptOnly')}));}} aria-invalid={Boolean(studentErrors.documentType)} className={validationInput(studentErrors.documentType)}><option value="" disabled selected hidden>Select document type</option><option value="Both">Diploma and transcript</option><option value="DiplomaOnly">Diploma only</option><option value="TranscriptOnly">Transcript only</option></select>{studentErrors.documentType&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.documentType}</span>}</label>
          <label className={label}>Portrait URL (optional)<input type="url" placeholder="https://example.com/photo.jpg" value={form.profilePicture} onChange={event=>{update('profilePicture',event.target.value);setStudentError('profilePicture',portraitUrlError(event.target.value));}} onBlur={()=>setStudentError('profilePicture',portraitUrlError(form.profilePicture))} aria-invalid={Boolean(studentErrors.profilePicture)} className={validationInput(studentErrors.profilePicture)}/>{studentErrors.profilePicture&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{studentErrors.profilePicture}</span>}</label>
        </div></section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-3"><h2 className="text-lg font-black">Transcript courses</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{subjects.length} added</span></div><p className="mt-1 text-sm text-slate-500">Import a complete transcript or add courses manually.</p></div><div className="flex max-w-sm flex-col items-start gap-2 sm:items-end"><input ref={transcriptInputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={uploadTranscript} className="sr-only"/><button type="button" disabled={importing} onClick={()=>transcriptInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>{importing?'Importing…':'Upload Transcript (Excel/CSV)'}</button><div className="flex gap-2 text-[11px] font-bold"><button type="button" onClick={()=>void downloadTemplate('xlsx')} className="text-emerald-800 underline decoration-emerald-300 underline-offset-4">XLSX template</button><span className="text-slate-300">·</span><button type="button" onClick={()=>void downloadTemplate('csv')} className="text-emerald-800 underline decoration-emerald-300 underline-offset-4">CSV template</button></div></div></div>
          {importMessage&&<div role={importMessage.kind==='error'?'alert':'status'} className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${importMessage.kind==='ok'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-700'}`}>{importMessage.text}</div>}
          <div className="mt-5 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(128px,.45fr)_minmax(128px,.45fr)_minmax(128px,.45fr)_auto]">
            <label className={`${label} min-w-0`}>Course Name<input type="text" placeholder="e.g., Data Structures" value={course.subjectName} onChange={event=>updateCourse('subjectName',event.target.value)} aria-invalid={Boolean(courseErrors.subjectName)} className={`${validationInput(courseErrors.subjectName)} min-w-0`}/>{courseErrors.subjectName&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{courseErrors.subjectName}</span>}</label>
            <label className={`${label} min-w-0`}>Semester<input type="number" inputMode="numeric" min="1" max={semesterLimit} step="1" placeholder={semesterLimit===14?'1-14':'1-8'} value={course.semesterNumber} onChange={event=>updateCourse('semesterNumber',event.target.value)} aria-invalid={Boolean(courseErrors.semesterNumber)} className={`${validationInput(courseErrors.semesterNumber)} min-w-0`}/>{courseErrors.semesterNumber&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{courseErrors.semesterNumber}</span>}</label>
            <label className={`${label} min-w-0`}>Grade / Score<input type="number" inputMode="numeric" min="0" max="100" step="1" placeholder="0-100" value={course.score} onChange={event=>updateCourse('score',event.target.value)} aria-invalid={Boolean(courseErrors.score)} className={`${validationInput(courseErrors.score)} min-w-0`}/>{courseErrors.score&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{courseErrors.score}</span>}</label>
            <label className={`${label} min-w-0`}>Credit Hours<input type="number" inputMode="numeric" min="1" max="6" step="1" placeholder="1-6" value={course.creditHours} onChange={event=>updateCourse('creditHours',event.target.value)} aria-invalid={Boolean(courseErrors.creditHours)} className={`${validationInput(courseErrors.creditHours)} min-w-0`}/>{courseErrors.creditHours&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{courseErrors.creditHours}</span>}</label>
            <button type="button" disabled={!courseIsValid} onClick={addCourse} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900 sm:col-span-2 xl:col-span-1 xl:mt-6">Add</button>
          </div>
          {subjects.length>0&&<div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Course name</th><th className="px-4 py-3 text-center">Credits</th><th className="px-4 py-3 text-center">Score</th><th className="px-4 py-3 text-center">Semester</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{subjects.map((item,index)=><tr key={`${item.semesterNumber}-${item.subjectName}-${index}`}><td className="px-4 py-3 font-semibold">{item.subjectName}</td><td className="px-4 py-3 text-center">{item.creditHours}</td><td className="px-4 py-3 text-center font-bold text-emerald-800">{item.score}</td><td className="px-4 py-3 text-center">{item.semesterNumber}</td><td className="px-4 py-3 text-right"><button type="button" onClick={()=>setSubjects(current=>current.filter((_,position)=>position!==index))} className="font-bold text-red-600">Remove</button></td></tr>)}</tbody></table></div>}
        </section>
      </div>

      <aside className="h-fit space-y-5 rounded-3xl bg-emerald-950 p-6 text-white shadow-xl lg:sticky lg:top-24"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Issuance settings</p><h2 className="mt-2 text-xl font-black">Record provenance</h2></div><div className="grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">{['DigitalFirst','Legacy'].map(system=><button type="button" key={system} onClick={()=>update('issuanceSystem',system)} className={`rounded-lg px-3 py-2 text-xs font-bold ${form.issuanceSystem===system?'bg-white text-emerald-950':'text-emerald-100'}`}>{system==='DigitalFirst'?'Digital':'Legacy'}</button>)}</div>
        {form.issuanceSystem==='Legacy'&&<label className="block text-xs font-bold uppercase tracking-wide text-emerald-200">Maktoub number<input required value={form.legacyMaktoubNumber} onChange={event=>update('legacyMaktoubNumber',event.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none focus:border-emerald-300"/></label>}
        <label className="block text-xs font-bold uppercase tracking-wide text-emerald-200">Replaces credential code (optional)<input disabled={Boolean(editingCode)} value={form.supersedesVerificationCode} maxLength={14} placeholder="e.g., KU-491029481" onChange={event=>{const value=event.target.value.replace(/[^A-Za-z0-9-]/g,'').toUpperCase();update('supersedesVerificationCode',value);setStudentError('supersedesVerificationCode',replacementCodeError(value));}} aria-invalid={Boolean(studentErrors.supersedesVerificationCode)} className={`${issuanceInput(studentErrors.supersedesVerificationCode)} disabled:cursor-not-allowed disabled:opacity-60`}/>{studentErrors.supersedesVerificationCode&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-200">{studentErrors.supersedesVerificationCode}</span>}<span className="mt-2 block text-xs font-medium normal-case leading-5 tracking-normal text-emerald-200/70">{editingCode?'The replacement relationship cannot be changed while correcting a pending record.':'Use only when issuing a corrected replacement for an existing verified credential.'}</span></label>
        <label className="block text-xs font-bold uppercase tracking-wide text-emerald-200">Verifiable diploma link (PDF/Image)<input type="url" placeholder="https://storage.com" value={form.diplomaFileUrl} onChange={event=>{update('diplomaFileUrl',event.target.value);setStudentError('diplomaFileUrl',documentUrlError(event.target.value,'Diploma',requiresDiplomaUrl));}} onBlur={()=>setStudentError('diplomaFileUrl',documentUrlError(form.diplomaFileUrl,'Diploma',requiresDiplomaUrl))} aria-invalid={Boolean(studentErrors.diplomaFileUrl)} className={issuanceInput(studentErrors.diplomaFileUrl)}/>{studentErrors.diplomaFileUrl&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-200">{studentErrors.diplomaFileUrl}</span>}</label>
        <label className="block text-xs font-bold uppercase tracking-wide text-emerald-200">Verifiable transcript link (PDF/Image)<input type="url" placeholder="https://storage.com" value={form.transcriptFileUrl} onChange={event=>{update('transcriptFileUrl',event.target.value);setStudentError('transcriptFileUrl',documentUrlError(event.target.value,'Transcript',requiresTranscriptUrl));}} onBlur={()=>setStudentError('transcriptFileUrl',documentUrlError(form.transcriptFileUrl,'Transcript',requiresTranscriptUrl))} aria-invalid={Boolean(studentErrors.transcriptFileUrl)} className={issuanceInput(studentErrors.transcriptFileUrl)}/>{studentErrors.transcriptFileUrl&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-200">{studentErrors.transcriptFileUrl}</span>}</label>
        <p className="-mt-2 text-xs leading-5 text-emerald-200/80">This file link will be displayed to anyone verifying the student's unique credential code.</p>
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/50 p-4 text-xs leading-5 text-emerald-100">Every imported course is validated against the same API constraints before the signed record is submitted.</div><button disabled={loading||(submitAttempted&&!formIsValid)} aria-disabled={loading||(submitAttempted&&!formIsValid)} className="w-full rounded-xl bg-emerald-400 px-4 py-3.5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50">{loading?'Signing and submitting…':editingCode?'Save corrected pending record':'Issue secure credential'}</button>
      </aside>
    </form></>}
  </section>;
}
