import { PrismaClient, UserRole, NoteType, NoteStatus, CodeType, IntegrationType, RecordingType, RecordingStatus, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireDemoPassword(): string {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error('DEMO_PASSWORD must be at least 12 characters');
  return password;
}

async function main() {
  console.log('Seeding database with comprehensive data...');

  // ==================== SPECIALTIES (20 items) ====================
  const specialties = [
    { name: 'Internal Medicine', description: 'General internal medicine practice' },
    { name: 'Family Medicine', description: 'Family and general practice' },
    { name: 'Cardiology', description: 'Heart and cardiovascular system' },
    { name: 'Dermatology', description: 'Skin conditions and diseases' },
    { name: 'Neurology', description: 'Nervous system disorders' },
    { name: 'Orthopedics', description: 'Musculoskeletal system' },
    { name: 'Pediatrics', description: 'Child healthcare' },
    { name: 'Psychiatry', description: 'Mental health' },
    { name: 'Surgery', description: 'Surgical procedures' },
    { name: 'Emergency Medicine', description: 'Emergency care' },
    { name: 'Oncology', description: 'Cancer treatment' },
    { name: 'Pulmonology', description: 'Respiratory system' },
    { name: 'Gastroenterology', description: 'Digestive system' },
    { name: 'Endocrinology', description: 'Hormonal disorders' },
    { name: 'Rheumatology', description: 'Autoimmune and joint diseases' },
    { name: 'Nephrology', description: 'Kidney diseases' },
    { name: 'Urology', description: 'Urinary system' },
    { name: 'Ophthalmology', description: 'Eye care' },
    { name: 'Otolaryngology', description: 'Ear, nose, and throat' },
    { name: 'Obstetrics & Gynecology', description: 'Women\'s health' },
  ];

  for (const specialty of specialties) {
    await prisma.specialty.upsert({
      where: { name: specialty.name },
      update: {},
      create: specialty,
    });
  }
  console.log(`Created ${specialties.length} specialties`);

  // ==================== USERS (20 users) ====================
  const hashedPassword = await bcrypt.hash(requireDemoPassword(), 10);

  const users = [
    { email: 'admin@healthcare.com', firstName: 'System', lastName: 'Administrator', role: UserRole.ADMIN, specialty: null },
    { email: 'dr.smith@healthcare.com', firstName: 'John', lastName: 'Smith', role: UserRole.PROVIDER, specialty: 'Internal Medicine', npiNumber: '1234567890' },
    { email: 'dr.johnson@healthcare.com', firstName: 'Emily', lastName: 'Johnson', role: UserRole.PROVIDER, specialty: 'Cardiology', npiNumber: '1234567891' },
    { email: 'dr.williams@healthcare.com', firstName: 'Michael', lastName: 'Williams', role: UserRole.PROVIDER, specialty: 'Neurology', npiNumber: '1234567892' },
    { email: 'dr.brown@healthcare.com', firstName: 'Sarah', lastName: 'Brown', role: UserRole.PROVIDER, specialty: 'Pediatrics', npiNumber: '1234567893' },
    { email: 'dr.davis@healthcare.com', firstName: 'Robert', lastName: 'Davis', role: UserRole.PROVIDER, specialty: 'Orthopedics', npiNumber: '1234567894' },
    { email: 'dr.miller@healthcare.com', firstName: 'Jennifer', lastName: 'Miller', role: UserRole.PROVIDER, specialty: 'Dermatology', npiNumber: '1234567895' },
    { email: 'dr.wilson@healthcare.com', firstName: 'David', lastName: 'Wilson', role: UserRole.PROVIDER, specialty: 'Psychiatry', npiNumber: '1234567896' },
    { email: 'dr.moore@healthcare.com', firstName: 'Lisa', lastName: 'Moore', role: UserRole.PROVIDER, specialty: 'Emergency Medicine', npiNumber: '1234567897' },
    { email: 'dr.taylor@healthcare.com', firstName: 'James', lastName: 'Taylor', role: UserRole.PROVIDER, specialty: 'Surgery', npiNumber: '1234567898' },
    { email: 'dr.anderson@healthcare.com', firstName: 'Patricia', lastName: 'Anderson', role: UserRole.PROVIDER, specialty: 'Oncology', npiNumber: '1234567899' },
    { email: 'nurse.jones@healthcare.com', firstName: 'Sarah', lastName: 'Jones', role: UserRole.NURSE, specialty: null },
    { email: 'nurse.garcia@healthcare.com', firstName: 'Maria', lastName: 'Garcia', role: UserRole.NURSE, specialty: null },
    { email: 'nurse.martinez@healthcare.com', firstName: 'Carlos', lastName: 'Martinez', role: UserRole.NURSE, specialty: null },
    { email: 'nurse.rodriguez@healthcare.com', firstName: 'Ana', lastName: 'Rodriguez', role: UserRole.NURSE, specialty: null },
    { email: 'ma.thomas@healthcare.com', firstName: 'Jessica', lastName: 'Thomas', role: UserRole.MEDICAL_ASSISTANT, specialty: null },
    { email: 'ma.jackson@healthcare.com', firstName: 'Kevin', lastName: 'Jackson', role: UserRole.MEDICAL_ASSISTANT, specialty: null },
    { email: 'billing.white@healthcare.com', firstName: 'Amanda', lastName: 'White', role: UserRole.BILLING_STAFF, specialty: null },
    { email: 'billing.harris@healthcare.com', firstName: 'Daniel', lastName: 'Harris', role: UserRole.BILLING_STAFF, specialty: null },
    { email: 'auditor@healthcare.com', firstName: 'Compliance', lastName: 'Officer', role: UserRole.AUDITOR, specialty: null },
  ];

  const createdUsers: any[] = [];
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: hashedPassword,
        isActive: true,
      },
    });
    createdUsers.push(user);
  }
  console.log(`Created ${users.length} users`);

  // ==================== NOTE TEMPLATES (20 templates) ====================
  const templates = [
    {
      id: 'soap-note-general',
      name: 'SOAP Note - General',
      description: 'Standard SOAP note template for general encounters',
      noteType: NoteType.SOAP,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'subjective', name: 'Subjective', type: 'textarea', required: true },
        { id: 'objective', name: 'Objective', type: 'textarea', required: true },
        { id: 'vitals', name: 'Vitals', type: 'vitals', required: false },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'progress-note',
      name: 'Progress Note',
      description: 'Follow-up visit progress note',
      noteType: NoteType.PROGRESS,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'interval_history', name: 'Interval History', type: 'textarea', required: true },
        { id: 'current_medications', name: 'Current Medications', type: 'medication', required: false },
        { id: 'physical_exam', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'consultation-note',
      name: 'Consultation Note',
      description: 'Specialist consultation note',
      noteType: NoteType.CONSULTATION,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'reason', name: 'Reason for Consultation', type: 'textarea', required: true },
        { id: 'history', name: 'History of Present Illness', type: 'textarea', required: true },
        { id: 'past_history', name: 'Past Medical History', type: 'textarea', required: false },
        { id: 'examination', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'impression', name: 'Impression', type: 'textarea', required: true },
        { id: 'recommendations', name: 'Recommendations', type: 'textarea', required: true },
      ],
    },
    {
      id: 'cardiology-soap',
      name: 'Cardiology SOAP',
      description: 'Cardiology-specific SOAP note',
      noteType: NoteType.SOAP,
      specialty: 'Cardiology',
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'cardiac_history', name: 'Cardiac History', type: 'textarea', required: true },
        { id: 'vitals', name: 'Vitals', type: 'vitals', required: true },
        { id: 'cardiac_exam', name: 'Cardiac Examination', type: 'textarea', required: true },
        { id: 'ekg_findings', name: 'EKG Findings', type: 'textarea', required: false },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'procedure-note',
      name: 'Procedure Note',
      description: 'Standard procedure documentation',
      noteType: NoteType.PROCEDURE,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'procedure_name', name: 'Procedure Name', type: 'text', required: true },
        { id: 'indication', name: 'Indication', type: 'textarea', required: true },
        { id: 'consent', name: 'Consent', type: 'text', required: true },
        { id: 'anesthesia', name: 'Anesthesia', type: 'text', required: false },
        { id: 'technique', name: 'Technique', type: 'textarea', required: true },
        { id: 'findings', name: 'Findings', type: 'textarea', required: true },
        { id: 'complications', name: 'Complications', type: 'textarea', required: true },
        { id: 'disposition', name: 'Disposition', type: 'textarea', required: true },
      ],
    },
    {
      id: 'emergency-note',
      name: 'Emergency Room Note',
      description: 'Emergency department encounter note',
      noteType: NoteType.EMERGENCY,
      specialty: 'Emergency Medicine',
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'triage', name: 'Triage Assessment', type: 'textarea', required: true },
        { id: 'hpi', name: 'History of Present Illness', type: 'textarea', required: true },
        { id: 'vitals', name: 'Vitals', type: 'vitals', required: true },
        { id: 'exam', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'diagnostics', name: 'Diagnostic Studies', type: 'textarea', required: false },
        { id: 'mdm', name: 'Medical Decision Making', type: 'textarea', required: true },
        { id: 'disposition', name: 'Disposition', type: 'textarea', required: true },
      ],
    },
    {
      id: 'telehealth-visit',
      name: 'Telehealth Visit',
      description: 'Virtual/telehealth encounter note',
      noteType: NoteType.TELEHEALTH,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'tech_assessment', name: 'Technology Assessment', type: 'text', required: true },
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'hpi', name: 'History of Present Illness', type: 'textarea', required: true },
        { id: 'visual_exam', name: 'Visual Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
        { id: 'followup', name: 'Follow-up Instructions', type: 'textarea', required: true },
      ],
    },
    {
      id: 'discharge-summary',
      name: 'Discharge Summary',
      description: 'Hospital discharge summary',
      noteType: NoteType.DISCHARGE,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'admission_date', name: 'Admission Date', type: 'date', required: true },
        { id: 'discharge_date', name: 'Discharge Date', type: 'date', required: true },
        { id: 'admitting_diagnosis', name: 'Admitting Diagnosis', type: 'diagnosis', required: true },
        { id: 'discharge_diagnosis', name: 'Discharge Diagnosis', type: 'diagnosis', required: true },
        { id: 'hospital_course', name: 'Hospital Course', type: 'textarea', required: true },
        { id: 'procedures', name: 'Procedures Performed', type: 'textarea', required: false },
        { id: 'discharge_meds', name: 'Discharge Medications', type: 'medication', required: true },
        { id: 'followup', name: 'Follow-up Instructions', type: 'textarea', required: true },
      ],
    },
    {
      id: 'admission-note',
      name: 'Admission Note',
      description: 'Hospital admission documentation',
      noteType: NoteType.ADMISSION,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'hpi', name: 'History of Present Illness', type: 'textarea', required: true },
        { id: 'past_medical', name: 'Past Medical History', type: 'textarea', required: true },
        { id: 'medications', name: 'Medications', type: 'medication', required: true },
        { id: 'allergies', name: 'Allergies', type: 'textarea', required: true },
        { id: 'social_history', name: 'Social History', type: 'textarea', required: false },
        { id: 'family_history', name: 'Family History', type: 'textarea', required: false },
        { id: 'physical_exam', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'operative-note',
      name: 'Operative Note',
      description: 'Surgical procedure documentation',
      noteType: NoteType.OPERATIVE,
      specialty: 'Surgery',
      isSystem: true,
      sections: [
        { id: 'preop_diagnosis', name: 'Preoperative Diagnosis', type: 'diagnosis', required: true },
        { id: 'postop_diagnosis', name: 'Postoperative Diagnosis', type: 'diagnosis', required: true },
        { id: 'procedure', name: 'Procedure Performed', type: 'text', required: true },
        { id: 'surgeon', name: 'Surgeon', type: 'text', required: true },
        { id: 'anesthesia', name: 'Anesthesia', type: 'text', required: true },
        { id: 'findings', name: 'Findings', type: 'textarea', required: true },
        { id: 'technique', name: 'Technique', type: 'textarea', required: true },
        { id: 'specimens', name: 'Specimens', type: 'textarea', required: false },
        { id: 'blood_loss', name: 'Estimated Blood Loss', type: 'text', required: true },
        { id: 'complications', name: 'Complications', type: 'textarea', required: true },
      ],
    },
    {
      id: 'followup-note',
      name: 'Follow-up Note',
      description: 'Post-treatment follow-up documentation',
      noteType: NoteType.FOLLOWUP,
      specialty: null,
      isSystem: true,
      sections: [
        { id: 'interval_since', name: 'Interval Since Last Visit', type: 'text', required: true },
        { id: 'current_status', name: 'Current Status', type: 'textarea', required: true },
        { id: 'vitals', name: 'Vitals', type: 'vitals', required: false },
        { id: 'examination', name: 'Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'neurology-soap',
      name: 'Neurology SOAP',
      description: 'Neurology-specific SOAP note',
      noteType: NoteType.SOAP,
      specialty: 'Neurology',
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'neuro_history', name: 'Neurological History', type: 'textarea', required: true },
        { id: 'mental_status', name: 'Mental Status Exam', type: 'textarea', required: true },
        { id: 'cranial_nerves', name: 'Cranial Nerves', type: 'textarea', required: true },
        { id: 'motor_exam', name: 'Motor Examination', type: 'textarea', required: true },
        { id: 'sensory_exam', name: 'Sensory Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'pediatrics-wellchild',
      name: 'Pediatrics Well-Child Visit',
      description: 'Pediatric well-child check-up',
      noteType: NoteType.PROGRESS,
      specialty: 'Pediatrics',
      isSystem: true,
      sections: [
        { id: 'growth', name: 'Growth Parameters', type: 'vitals', required: true },
        { id: 'development', name: 'Developmental Assessment', type: 'textarea', required: true },
        { id: 'nutrition', name: 'Nutrition', type: 'textarea', required: true },
        { id: 'safety', name: 'Safety Counseling', type: 'textarea', required: false },
        { id: 'immunizations', name: 'Immunizations', type: 'textarea', required: true },
        { id: 'physical_exam', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'anticipatory_guidance', name: 'Anticipatory Guidance', type: 'textarea', required: true },
      ],
    },
    {
      id: 'psychiatry-initial',
      name: 'Psychiatry Initial Evaluation',
      description: 'Initial psychiatric evaluation',
      noteType: NoteType.CONSULTATION,
      specialty: 'Psychiatry',
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'hpi', name: 'History of Present Illness', type: 'textarea', required: true },
        { id: 'psychiatric_history', name: 'Psychiatric History', type: 'textarea', required: true },
        { id: 'substance_history', name: 'Substance Use History', type: 'textarea', required: true },
        { id: 'mental_status', name: 'Mental Status Examination', type: 'textarea', required: true },
        { id: 'risk_assessment', name: 'Risk Assessment', type: 'textarea', required: true },
        { id: 'diagnosis', name: 'Diagnosis', type: 'diagnosis', required: true },
        { id: 'treatment_plan', name: 'Treatment Plan', type: 'textarea', required: true },
      ],
    },
    {
      id: 'dermatology-exam',
      name: 'Dermatology Examination',
      description: 'Dermatology skin examination note',
      noteType: NoteType.SOAP,
      specialty: 'Dermatology',
      isSystem: true,
      sections: [
        { id: 'chief_complaint', name: 'Chief Complaint', type: 'text', required: true },
        { id: 'lesion_history', name: 'Lesion History', type: 'textarea', required: true },
        { id: 'skin_exam', name: 'Skin Examination', type: 'textarea', required: true },
        { id: 'lesion_description', name: 'Lesion Description', type: 'textarea', required: true },
        { id: 'diagnosis', name: 'Diagnosis', type: 'diagnosis', required: true },
        { id: 'treatment', name: 'Treatment', type: 'textarea', required: true },
      ],
    },
    {
      id: 'orthopedics-injury',
      name: 'Orthopedic Injury Evaluation',
      description: 'Orthopedic injury assessment',
      noteType: NoteType.CONSULTATION,
      specialty: 'Orthopedics',
      isSystem: true,
      sections: [
        { id: 'mechanism', name: 'Mechanism of Injury', type: 'textarea', required: true },
        { id: 'symptoms', name: 'Current Symptoms', type: 'textarea', required: true },
        { id: 'physical_exam', name: 'Physical Examination', type: 'textarea', required: true },
        { id: 'imaging', name: 'Imaging Results', type: 'textarea', required: false },
        { id: 'diagnosis', name: 'Diagnosis', type: 'diagnosis', required: true },
        { id: 'treatment', name: 'Treatment Plan', type: 'textarea', required: true },
        { id: 'restrictions', name: 'Activity Restrictions', type: 'textarea', required: true },
      ],
    },
    {
      id: 'gi-endoscopy',
      name: 'GI Endoscopy Report',
      description: 'Gastrointestinal endoscopy procedure note',
      noteType: NoteType.PROCEDURE,
      specialty: 'Gastroenterology',
      isSystem: true,
      sections: [
        { id: 'indication', name: 'Indication', type: 'textarea', required: true },
        { id: 'procedure_type', name: 'Procedure Type', type: 'text', required: true },
        { id: 'sedation', name: 'Sedation', type: 'text', required: true },
        { id: 'findings', name: 'Endoscopic Findings', type: 'textarea', required: true },
        { id: 'interventions', name: 'Interventions', type: 'textarea', required: false },
        { id: 'specimens', name: 'Specimens', type: 'textarea', required: false },
        { id: 'impression', name: 'Impression', type: 'textarea', required: true },
        { id: 'recommendations', name: 'Recommendations', type: 'textarea', required: true },
      ],
    },
    {
      id: 'pulm-function',
      name: 'Pulmonary Function Test',
      description: 'Pulmonary function test interpretation',
      noteType: NoteType.PROGRESS,
      specialty: 'Pulmonology',
      isSystem: true,
      sections: [
        { id: 'indication', name: 'Indication for Test', type: 'textarea', required: true },
        { id: 'spirometry', name: 'Spirometry Results', type: 'textarea', required: true },
        { id: 'lung_volumes', name: 'Lung Volumes', type: 'textarea', required: false },
        { id: 'dlco', name: 'DLCO', type: 'textarea', required: false },
        { id: 'interpretation', name: 'Interpretation', type: 'textarea', required: true },
        { id: 'recommendations', name: 'Recommendations', type: 'textarea', required: true },
      ],
    },
    {
      id: 'oncology-treatment',
      name: 'Oncology Treatment Note',
      description: 'Cancer treatment documentation',
      noteType: NoteType.PROGRESS,
      specialty: 'Oncology',
      isSystem: true,
      sections: [
        { id: 'diagnosis', name: 'Cancer Diagnosis', type: 'diagnosis', required: true },
        { id: 'treatment_cycle', name: 'Treatment Cycle', type: 'text', required: true },
        { id: 'current_status', name: 'Current Status', type: 'textarea', required: true },
        { id: 'side_effects', name: 'Side Effects', type: 'textarea', required: true },
        { id: 'labs', name: 'Laboratory Results', type: 'textarea', required: true },
        { id: 'assessment', name: 'Assessment', type: 'textarea', required: true },
        { id: 'plan', name: 'Plan', type: 'textarea', required: true },
      ],
    },
  ];

  for (const template of templates) {
    await prisma.noteTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: template,
    });
  }
  console.log(`Created ${templates.length} templates`);

  // ==================== CPT CODES (30 codes) ====================
  const cptCodes = [
    { code: '99201', description: 'Office visit, new patient, minimal complexity', category: 'Evaluation & Management' },
    { code: '99202', description: 'Office visit, new patient, straightforward complexity', category: 'Evaluation & Management' },
    { code: '99203', description: 'Office visit, new patient, low complexity', category: 'Evaluation & Management' },
    { code: '99204', description: 'Office visit, new patient, moderate complexity', category: 'Evaluation & Management' },
    { code: '99205', description: 'Office visit, new patient, high complexity', category: 'Evaluation & Management' },
    { code: '99211', description: 'Office visit, established patient, minimal complexity', category: 'Evaluation & Management' },
    { code: '99212', description: 'Office visit, established patient, straightforward complexity', category: 'Evaluation & Management' },
    { code: '99213', description: 'Office visit, established patient, low complexity', category: 'Evaluation & Management' },
    { code: '99214', description: 'Office visit, established patient, moderate complexity', category: 'Evaluation & Management' },
    { code: '99215', description: 'Office visit, established patient, high complexity', category: 'Evaluation & Management' },
    { code: '99281', description: 'Emergency department visit, minor', category: 'Emergency' },
    { code: '99282', description: 'Emergency department visit, low complexity', category: 'Emergency' },
    { code: '99283', description: 'Emergency department visit, moderate complexity', category: 'Emergency' },
    { code: '99284', description: 'Emergency department visit, high complexity', category: 'Emergency' },
    { code: '99285', description: 'Emergency department visit, critical', category: 'Emergency' },
    { code: '99441', description: 'Telephone E/M, 5-10 minutes', category: 'Telehealth' },
    { code: '99442', description: 'Telephone E/M, 11-20 minutes', category: 'Telehealth' },
    { code: '99443', description: 'Telephone E/M, 21-30 minutes', category: 'Telehealth' },
    { code: '99221', description: 'Initial hospital care, low complexity', category: 'Hospital' },
    { code: '99222', description: 'Initial hospital care, moderate complexity', category: 'Hospital' },
    { code: '99223', description: 'Initial hospital care, high complexity', category: 'Hospital' },
    { code: '99231', description: 'Subsequent hospital care, low complexity', category: 'Hospital' },
    { code: '99232', description: 'Subsequent hospital care, moderate complexity', category: 'Hospital' },
    { code: '99233', description: 'Subsequent hospital care, high complexity', category: 'Hospital' },
    { code: '99238', description: 'Hospital discharge day management, 30 minutes or less', category: 'Hospital' },
    { code: '99239', description: 'Hospital discharge day management, more than 30 minutes', category: 'Hospital' },
    { code: '99241', description: 'Office consultation, straightforward', category: 'Consultation' },
    { code: '99242', description: 'Office consultation, low complexity', category: 'Consultation' },
    { code: '99243', description: 'Office consultation, moderate complexity', category: 'Consultation' },
    { code: '99244', description: 'Office consultation, high complexity', category: 'Consultation' },
  ];

  // ==================== ICD-10 CODES (30 codes) ====================
  const icd10Codes = [
    { code: 'I10', description: 'Essential hypertension', category: 'Cardiovascular' },
    { code: 'I25.10', description: 'Atherosclerotic heart disease', category: 'Cardiovascular' },
    { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
    { code: 'E11.65', description: 'Type 2 diabetes with hyperglycemia', category: 'Endocrine' },
    { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine' },
    { code: 'J06.9', description: 'Acute upper respiratory infection', category: 'Respiratory' },
    { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory' },
    { code: 'J44.1', description: 'COPD with acute exacerbation', category: 'Respiratory' },
    { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
    { code: 'M25.50', description: 'Pain in unspecified joint', category: 'Musculoskeletal' },
    { code: 'M79.3', description: 'Panniculitis, unspecified', category: 'Musculoskeletal' },
    { code: 'F32.9', description: 'Major depressive disorder, single episode', category: 'Mental Health' },
    { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health' },
    { code: 'F43.10', description: 'Post-traumatic stress disorder', category: 'Mental Health' },
    { code: 'K21.0', description: 'GERD with esophagitis', category: 'Digestive' },
    { code: 'K58.9', description: 'Irritable bowel syndrome', category: 'Digestive' },
    { code: 'G43.909', description: 'Migraine, unspecified', category: 'Neurological' },
    { code: 'G47.00', description: 'Insomnia, unspecified', category: 'Neurological' },
    { code: 'N39.0', description: 'Urinary tract infection', category: 'Genitourinary' },
    { code: 'R05', description: 'Cough', category: 'Symptoms' },
    { code: 'R10.9', description: 'Unspecified abdominal pain', category: 'Symptoms' },
    { code: 'R51', description: 'Headache', category: 'Symptoms' },
    { code: 'R53.83', description: 'Fatigue', category: 'Symptoms' },
    { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Dermatological' },
    { code: 'L70.0', description: 'Acne vulgaris', category: 'Dermatological' },
    { code: 'N18.3', description: 'Chronic kidney disease, stage 3', category: 'Renal' },
    { code: 'D64.9', description: 'Anemia, unspecified', category: 'Hematological' },
    { code: 'B34.9', description: 'Viral infection, unspecified', category: 'Infectious' },
    { code: 'Z00.00', description: 'General adult medical examination', category: 'Preventive' },
  ];

  for (const code of cptCodes) {
    await prisma.codeReference.upsert({
      where: { codeType_code: { codeType: CodeType.CPT, code: code.code } },
      update: {},
      create: { codeType: CodeType.CPT, ...code },
    });
  }

  for (const code of icd10Codes) {
    await prisma.codeReference.upsert({
      where: { codeType_code: { codeType: CodeType.ICD10, code: code.code } },
      update: {},
      create: { codeType: CodeType.ICD10, ...code },
    });
  }
  console.log(`Created ${cptCodes.length + icd10Codes.length} medical codes`);

  // ==================== INTEGRATIONS (15 integrations) ====================
  const integrations = [
    { id: 'epic-ehr', name: 'Epic EHR', type: IntegrationType.EHR, configuration: { apiEndpoint: '', clientId: '' } },
    { id: 'cerner-ehr', name: 'Cerner EHR', type: IntegrationType.EHR, configuration: { apiEndpoint: '', clientId: '' } },
    { id: 'allscripts-ehr', name: 'Allscripts EHR', type: IntegrationType.EHR, configuration: { apiEndpoint: '', clientId: '' } },
    { id: 'athenahealth', name: 'Athenahealth', type: IntegrationType.PRACTICE_MANAGEMENT, configuration: { apiEndpoint: '', practiceId: '' } },
    { id: 'drchrono', name: 'DrChrono', type: IntegrationType.PRACTICE_MANAGEMENT, configuration: { apiEndpoint: '', practiceId: '' } },
    { id: 'nextgen', name: 'NextGen', type: IntegrationType.PRACTICE_MANAGEMENT, configuration: { apiEndpoint: '', practiceId: '' } },
    { id: 'kareo-billing', name: 'Kareo Billing', type: IntegrationType.BILLING, configuration: { apiEndpoint: '', accountId: '' } },
    { id: 'advancedmd-billing', name: 'AdvancedMD Billing', type: IntegrationType.BILLING, configuration: { apiEndpoint: '', accountId: '' } },
    { id: 'waystar', name: 'Waystar', type: IntegrationType.BILLING, configuration: { apiEndpoint: '', accountId: '' } },
    { id: 'quest-labs', name: 'Quest Diagnostics', type: IntegrationType.LAB, configuration: { apiEndpoint: '', accountId: '' } },
    { id: 'labcorp', name: 'LabCorp', type: IntegrationType.LAB, configuration: { apiEndpoint: '', accountId: '' } },
    { id: 'surescripts', name: 'Surescripts', type: IntegrationType.PHARMACY, configuration: { apiEndpoint: '', pharmacyId: '' } },
    { id: 'covermymeds', name: 'CoverMyMeds', type: IntegrationType.PHARMACY, configuration: { apiEndpoint: '', pharmacyId: '' } },
    { id: 'pacs-imaging', name: 'PACS Imaging', type: IntegrationType.IMAGING, configuration: { apiEndpoint: '', facilityId: '' } },
    { id: 'radiology-ai', name: 'Radiology AI', type: IntegrationType.IMAGING, configuration: { apiEndpoint: '', facilityId: '' } },
  ];

  for (const integration of integrations) {
    await prisma.integration.upsert({
      where: { id: integration.id },
      update: {},
      create: integration,
    });
  }
  console.log(`Created ${integrations.length} integrations`);

  // ==================== SAMPLE NOTES (20 notes) ====================
  const providers = createdUsers.filter(u => u.role === 'PROVIDER');
  const adminUserForNotes = createdUsers.find(u => u.role === 'ADMIN') || createdUsers[0];
  const samplePatients = [
    { id: 'P001', name: 'Jane Doe' },
    { id: 'P002', name: 'John Smith' },
    { id: 'P003', name: 'Mary Johnson' },
    { id: 'P004', name: 'Robert Brown' },
    { id: 'P005', name: 'Patricia Davis' },
    { id: 'P006', name: 'Michael Miller' },
    { id: 'P007', name: 'Linda Wilson' },
    { id: 'P008', name: 'William Moore' },
    { id: 'P009', name: 'Elizabeth Taylor' },
    { id: 'P010', name: 'David Anderson' },
    { id: 'P011', name: 'Barbara Thomas' },
    { id: 'P012', name: 'Richard Jackson' },
    { id: 'P013', name: 'Susan White' },
    { id: 'P014', name: 'Joseph Harris' },
    { id: 'P015', name: 'Margaret Martin' },
  ];

  const noteContents = [
    {
      subjective: 'Patient presents with complaints of persistent headache for the past 3 days. Describes pain as throbbing, primarily in the frontal region.',
      objective: 'Alert and oriented. BP 128/82. HR 76. No focal neurological deficits. Fundoscopic exam normal.',
      vitals: { bp: '128/82', hr: '76', temp: '98.6', rr: '16' },
      assessment: 'Tension headache, likely stress-related.',
      plan: 'OTC analgesics as needed, stress management counseling, follow up in 2 weeks if symptoms persist.',
    },
    {
      subjective: 'Annual wellness visit. Patient reports feeling well overall. No new concerns.',
      objective: 'Well-appearing. BP 118/76. BMI 24.5. All systems reviewed and within normal limits.',
      vitals: { bp: '118/76', hr: '68', temp: '98.4', rr: '14' },
      assessment: 'Healthy adult, annual exam.',
      plan: 'Continue current medications, routine labs ordered, schedule colonoscopy per screening guidelines.',
    },
    {
      subjective: 'Follow-up for hypertension. Patient compliant with medications. No side effects noted.',
      objective: 'BP 132/84 on current regimen. No peripheral edema. Heart sounds normal.',
      vitals: { bp: '132/84', hr: '72', temp: '98.5', rr: '16' },
      assessment: 'Essential hypertension, controlled.',
      plan: 'Continue current medication. Lifestyle modifications discussed. Recheck in 3 months.',
    },
  ];

  for (let i = 0; i < 20; i++) {
    const patient = samplePatients[i % samplePatients.length];
    // First 5 notes are for admin user, rest for providers
    const author = i < 5 ? adminUserForNotes : providers[i % providers.length];
    const content = noteContents[i % noteContents.length];
    const status = i < 5 ? NoteStatus.DRAFT : i < 10 ? NoteStatus.PENDING_REVIEW : i < 15 ? NoteStatus.SIGNED : NoteStatus.AMENDED;

    const note = await prisma.note.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,
        encounterDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        noteType: NoteType.SOAP,
        status,
        authorId: author.id,
        templateId: 'soap-note-general',
        content,
        signedAt: status === NoteStatus.SIGNED || status === NoteStatus.AMENDED ? new Date() : null,
      },
    });

    // Create version history
    await prisma.noteVersion.create({
      data: {
        noteId: note.id,
        version: 1,
        content,
        changedBy: author.id,
        changeLog: 'Initial creation',
      },
    });
  }
  console.log('Created 20 sample notes with version history');

  // ==================== SAMPLE RECORDINGS (20 recordings) ====================
  const adminUserForRecordings = createdUsers.find(u => u.role === 'ADMIN') || createdUsers[0];

  // Create 15 recordings for admin user
  for (let i = 0; i < 15; i++) {
    await prisma.recording.create({
      data: {
        userId: adminUserForRecordings.id,
        type: i % 3 === 0 ? RecordingType.VIDEO : i % 3 === 1 ? RecordingType.SCREEN : RecordingType.AUDIO,
        status: i < 12 ? RecordingStatus.COMPLETED : RecordingStatus.PROCESSING,
        fileName: `patient_encounter_${i + 1}.webm`,
        filePath: `/uploads/recordings/patient_encounter_${i + 1}.webm`,
        fileSize: 1024 * 1024 * (i + 1),
        mimeType: i % 3 === 0 ? 'video/webm' : 'audio/webm',
        duration: 60 * (i + 1) + Math.floor(Math.random() * 120),
        recordedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        transcription: i < 12 ? `Patient encounter transcription ${i + 1}: Patient presented with symptoms. Discussed treatment options and follow-up care plan.` : null,
      },
    });
  }

  // Create 5 recordings for providers
  for (let i = 0; i < 5; i++) {
    const provider = providers[i % providers.length];
    await prisma.recording.create({
      data: {
        userId: provider.id,
        type: i % 3 === 0 ? RecordingType.VIDEO : i % 3 === 1 ? RecordingType.SCREEN : RecordingType.AUDIO,
        status: RecordingStatus.COMPLETED,
        fileName: `provider_recording_${i + 1}.webm`,
        filePath: `/uploads/recordings/provider_recording_${i + 1}.webm`,
        fileSize: 1024 * 1024 * (i + 2),
        mimeType: 'audio/webm',
        duration: 120 * (i + 1),
        recordedAt: new Date(Date.now() - (i + 15) * 24 * 60 * 60 * 1000),
        transcription: `Provider recording ${i + 1}: Clinical notes dictation.`,
      },
    });
  }
  console.log('Created 20 sample recordings (15 for admin, 5 for providers)');

  // ==================== SAMPLE COMMENTS (20 comments) ====================
  const notes = await prisma.note.findMany({ take: 10 });
  for (let i = 0; i < 20; i++) {
    const note = notes[i % notes.length];
    const commenter = createdUsers[i % createdUsers.length];
    await prisma.comment.create({
      data: {
        noteId: note.id,
        userId: commenter.id,
        content: `Sample comment ${i + 1}: This section needs clarification regarding the treatment plan.`,
        isResolved: i % 3 === 0,
      },
    });
  }
  console.log('Created 20 sample comments');

  // ==================== SAMPLE AUDIT LOGS (25 logs) ====================
  const auditActions = [AuditAction.CREATE, AuditAction.READ, AuditAction.UPDATE, AuditAction.LOGIN, AuditAction.SIGN];
  for (let i = 0; i < 25; i++) {
    await prisma.auditLog.create({
      data: {
        userId: createdUsers[i % createdUsers.length].id,
        action: auditActions[i % auditActions.length],
        entityType: i % 2 === 0 ? 'Note' : 'User',
        entityId: `entity-${i + 1}`,
        ipAddress: `192.168.1.${i + 1}`,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
  }
  console.log('Created 25 sample audit logs');

  // ==================== RETENTION POLICIES (5 policies) ====================
  const retentionPolicies = [
    { name: 'Medical Records Retention', description: 'Retain medical records for 7 years per HIPAA', entityType: 'Note', retentionDays: 2555, action: 'ARCHIVE' as const },
    { name: 'Audit Log Retention', description: 'Retain audit logs for 6 years', entityType: 'AuditLog', retentionDays: 2190, action: 'ARCHIVE' as const },
    { name: 'Recording Retention', description: 'Retain recordings for 3 years', entityType: 'Recording', retentionDays: 1095, action: 'DELETE' as const },
    { name: 'Session Data Retention', description: 'Retain session data for 90 days', entityType: 'Session', retentionDays: 90, action: 'DELETE' as const },
    { name: 'Amendment Retention', description: 'Retain amendments permanently', entityType: 'Amendment', retentionDays: 36500, action: 'ARCHIVE' as const },
  ];

  for (const policy of retentionPolicies) {
    await prisma.retentionPolicy.create({ data: policy });
  }
  console.log(`Created ${retentionPolicies.length} retention policies`);

  // ==================== SYSTEM SETTINGS (15 settings) ====================
  const settings = [
    { key: 'encryption_enabled', value: 'true', description: 'Enable HIPAA-compliant encryption' },
    { key: 'session_timeout', value: '30', description: 'Session timeout in minutes' },
    { key: 'password_expiry_days', value: '90', description: 'Password expiry in days' },
    { key: 'max_login_attempts', value: '5', description: 'Max failed login attempts before lockout' },
    { key: 'auto_save_interval', value: '30', description: 'Auto-save interval in seconds' },
    { key: 'default_note_template', value: 'soap-note-general', description: 'Default note template ID' },
    { key: 'ai_transcription_enabled', value: 'true', description: 'Enable AI transcription' },
    { key: 'ai_coding_enabled', value: 'true', description: 'Enable AI medical coding suggestions' },
    { key: 'ai_quality_check_enabled', value: 'true', description: 'Enable AI quality checking' },
    { key: 'ai_summarization_enabled', value: 'true', description: 'Enable AI summarization' },
    { key: 'require_cosign_residents', value: 'true', description: 'Require co-signature for resident notes' },
    { key: 'audit_log_enabled', value: 'true', description: 'Enable comprehensive audit logging' },
    { key: 'two_factor_enabled', value: 'false', description: 'Enable two-factor authentication' },
    { key: 'backup_frequency', value: 'daily', description: 'Database backup frequency' },
    { key: 'notification_email_enabled', value: 'true', description: 'Enable email notifications' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`Created ${settings.length} system settings`);

  // ==================== DOC CATEGORIES (6 categories) ====================
  const docCategories = [
    { name: 'API Documentation', slug: 'api-docs', description: 'API reference and endpoint documentation', icon: 'code', color: '#3B82F6' },
    { name: 'User Guides', slug: 'user-guides', description: 'End-user documentation and tutorials', icon: 'book', color: '#10B981' },
    { name: 'Development', slug: 'development', description: 'Developer guides and setup instructions', icon: 'terminal', color: '#8B5CF6' },
    { name: 'Architecture', slug: 'architecture', description: 'System architecture and design docs', icon: 'layers', color: '#F59E0B' },
    { name: 'Changelogs', slug: 'changelogs', description: 'Version history and release notes', icon: 'list', color: '#EF4444' },
    { name: 'Internal', slug: 'internal', description: 'Internal team documentation', icon: 'lock', color: '#6B7280' },
  ];

  const createdCategories: any[] = [];
  for (const cat of docCategories) {
    const category = await prisma.docCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    createdCategories.push(category);
  }
  console.log(`Created ${docCategories.length} doc categories`);

  // ==================== DOC TAGS (10 tags) ====================
  const docTags = [
    { name: 'Getting Started', slug: 'getting-started', color: '#22C55E' },
    { name: 'Advanced', slug: 'advanced', color: '#EF4444' },
    { name: 'Tutorial', slug: 'tutorial', color: '#3B82F6' },
    { name: 'Reference', slug: 'reference', color: '#8B5CF6' },
    { name: 'FAQ', slug: 'faq', color: '#F59E0B' },
    { name: 'Troubleshooting', slug: 'troubleshooting', color: '#EC4899' },
    { name: 'Best Practices', slug: 'best-practices', color: '#14B8A6' },
    { name: 'Security', slug: 'security', color: '#DC2626' },
    { name: 'Performance', slug: 'performance', color: '#7C3AED' },
    { name: 'Deprecated', slug: 'deprecated', color: '#6B7280' },
  ];

  const createdTags: any[] = [];
  for (const tag of docTags) {
    const createdTag = await prisma.docTag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
    createdTags.push(createdTag);
  }
  console.log(`Created ${docTags.length} doc tags`);

  // ==================== SAMPLE DOCS (20 documents) ====================
  const adminUser = createdUsers.find(u => u.role === 'ADMIN') || createdUsers[0];

  const sampleDocs = [
    {
      title: 'Getting Started with the API',
      slug: 'getting-started-api',
      content: `# Getting Started with the API

Welcome to our API documentation. This guide will help you get up and running quickly.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- API key (obtain from dashboard)

## Installation

\`\`\`bash
npm install @healthcare/api-client
\`\`\`

## Quick Start

\`\`\`javascript
import { HealthcareAPI } from '@healthcare/api-client';

const api = new HealthcareAPI({
  apiKey: process.env.API_KEY
});

// Fetch patient data
const patient = await api.patients.get('P001');
console.log(patient);
\`\`\`

## Next Steps

- Read the [Authentication Guide](/docs/authentication)
- Explore [API Endpoints](/docs/endpoints)
- Check out [Examples](/docs/examples)`,
      excerpt: 'Learn how to set up and start using our Healthcare API in minutes.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Authentication Guide',
      slug: 'authentication-guide',
      content: `# Authentication Guide

All API requests require authentication using API keys or OAuth 2.0 tokens.

## API Key Authentication

Include your API key in the request header:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.healthcare.com/v1/patients
\`\`\`

## OAuth 2.0

For user-specific actions, use OAuth 2.0:

1. Redirect user to authorization URL
2. Exchange code for access token
3. Use access token in requests

## Security Best Practices

- Never expose API keys in client-side code
- Rotate keys regularly
- Use environment variables
- Enable IP whitelisting`,
      excerpt: 'Learn about API authentication methods and security best practices.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Patient API Reference',
      slug: 'patient-api-reference',
      content: `# Patient API Reference

## Endpoints

### GET /patients

Retrieve a list of patients.

**Parameters:**
- \`limit\` (optional): Number of results (default: 20)
- \`offset\` (optional): Pagination offset

**Response:**
\`\`\`json
{
  "data": [
    {
      "id": "P001",
      "name": "John Doe",
      "dob": "1985-03-15"
    }
  ],
  "total": 100
}
\`\`\`

### GET /patients/:id

Retrieve a single patient by ID.

### POST /patients

Create a new patient record.

### PUT /patients/:id

Update an existing patient.

### DELETE /patients/:id

Delete a patient record.`,
      excerpt: 'Complete reference for Patient API endpoints.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Notes API Reference',
      slug: 'notes-api-reference',
      content: `# Notes API Reference

## Overview

The Notes API allows you to create, read, update, and delete clinical notes.

## Endpoints

### GET /notes

List all notes with optional filters.

### POST /notes

Create a new clinical note.

**Request Body:**
\`\`\`json
{
  "patientId": "P001",
  "noteType": "SOAP",
  "content": {
    "subjective": "Patient reports...",
    "objective": "Vital signs...",
    "assessment": "Diagnosis...",
    "plan": "Treatment..."
  }
}
\`\`\`

### GET /notes/:id

Retrieve a specific note.

### PUT /notes/:id

Update an existing note.`,
      excerpt: 'API reference for clinical notes management.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'User Guide: Creating Notes',
      slug: 'user-guide-creating-notes',
      content: `# Creating Clinical Notes

This guide walks you through creating clinical notes in the system.

## Step 1: Select Patient

1. Click on "Patients" in the sidebar
2. Search for the patient by name or ID
3. Click on the patient's name

## Step 2: Start New Note

1. Click "New Note" button
2. Select note type (SOAP, Progress, etc.)
3. Choose a template if available

## Step 3: Fill in Sections

Each note type has specific sections:

### SOAP Notes
- **Subjective**: Patient's complaints
- **Objective**: Examination findings
- **Assessment**: Diagnosis
- **Plan**: Treatment plan

## Step 4: Save and Sign

1. Click "Save Draft" to save progress
2. Click "Sign Note" when complete
3. Note becomes locked after signing`,
      excerpt: 'Step-by-step guide to creating clinical notes.',
      categorySlug: 'user-guides',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'User Guide: Recording Audio',
      slug: 'user-guide-recording-audio',
      content: `# Recording Audio for Transcription

Learn how to record patient encounters for AI-powered transcription.

## Starting a Recording

1. Open the patient's chart
2. Click the microphone icon
3. Grant browser permission if prompted
4. Click "Start Recording"

## During Recording

- Speak clearly
- Minimize background noise
- The timer shows recording duration
- Click "Pause" if needed

## Ending Recording

1. Click "Stop Recording"
2. Review the audio
3. Click "Transcribe" to process

## Transcription

The AI will:
- Convert speech to text
- Identify speakers
- Extract medical terms
- Suggest note sections

## Tips for Best Results

- Use a quality microphone
- Speak at normal pace
- Spell out unusual terms`,
      excerpt: 'How to record and transcribe patient encounters.',
      categorySlug: 'user-guides',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Development Setup Guide',
      slug: 'development-setup',
      content: `# Development Setup Guide

Set up your local development environment.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git

## Clone Repository

\`\`\`bash
git clone https://github.com/org/healthcare-app.git
cd healthcare-app
\`\`\`

## Install Dependencies

\`\`\`bash
npm install
\`\`\`

## Environment Setup

Copy the example environment file:

\`\`\`bash
cp .env.example .env
\`\`\`

Configure your database URL and API keys.

## Database Setup

\`\`\`bash
npm run db:push
npm run db:seed
\`\`\`

## Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit http://localhost:3000`,
      excerpt: 'Set up your local development environment.',
      categorySlug: 'development',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Database Schema Overview',
      slug: 'database-schema',
      content: `# Database Schema Overview

Our application uses PostgreSQL with Prisma ORM.

## Core Models

### User
Stores user accounts and authentication data.

### Note
Clinical notes with structured content.

### Recording
Audio/video recordings for transcription.

### Template
Note templates for different specialties.

## Relationships

\`\`\`
User 1:N Note
User 1:N Recording
Note 1:N NoteVersion
Note 1:N Comment
Note N:1 Template
\`\`\`

## Migrations

Run migrations with:

\`\`\`bash
npm run db:migrate
\`\`\``,
      excerpt: 'Overview of the database schema and models.',
      categorySlug: 'development',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'System Architecture',
      slug: 'system-architecture',
      content: `# System Architecture

## Overview

The Healthcare Documentation System is built with:

- **Frontend**: Next.js 14 with React 18
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma
- **AI Services**: OpenAI/OpenRouter

## Architecture Diagram

\`\`\`
┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Next.js   │
│  (Browser)  │◀────│   Server    │
└─────────────┘     └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  PostgreSQL │   │  AI Service │   │   Storage   │
│   Database  │   │  (OpenAI)   │   │   (Files)   │
└─────────────┘   └─────────────┘   └─────────────┘
\`\`\`

## Key Components

1. **Authentication**: JWT-based auth
2. **Note Editor**: Rich text with templates
3. **AI Transcription**: Speech-to-text
4. **Audit System**: HIPAA compliance`,
      excerpt: 'High-level system architecture documentation.',
      categorySlug: 'architecture',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Security Architecture',
      slug: 'security-architecture',
      content: `# Security Architecture

## HIPAA Compliance

Our system implements:

- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Access control (RBAC)
- Audit logging
- Data retention policies

## Authentication

- Password hashing (bcrypt)
- JWT tokens with expiry
- Session management
- Failed login lockout

## Authorization

Role-based access control:

| Role | Permissions |
|------|-------------|
| Admin | Full access |
| Provider | Read/Write notes |
| Nurse | Limited write |
| Auditor | Read-only |

## Data Protection

- PHI encryption
- Secure file storage
- Regular backups
- Disaster recovery`,
      excerpt: 'Security measures and HIPAA compliance details.',
      categorySlug: 'architecture',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Version 2.0.0 Release Notes',
      slug: 'changelog-v2-0-0',
      content: `# Version 2.0.0 Release Notes

Released: January 2025

## New Features

### AI-Powered Transcription
- Real-time speech-to-text
- Speaker identification
- Medical term extraction

### Documentation Module
- Markdown editor
- Version history
- Export to PDF/HTML/DOCX

### GitHub Integration
- Webhook support
- Auto-sync repositories
- JSDoc parsing

## Improvements

- 50% faster page loads
- Improved mobile experience
- Better error messages

## Bug Fixes

- Fixed note saving issues
- Resolved PDF export formatting
- Fixed timezone handling

## Breaking Changes

- API v1 deprecated
- New authentication flow`,
      excerpt: 'Release notes for version 2.0.0.',
      categorySlug: 'changelogs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Version 1.5.0 Release Notes',
      slug: 'changelog-v1-5-0',
      content: `# Version 1.5.0 Release Notes

Released: October 2024

## New Features

- Template management system
- Co-signature workflow
- Audit log viewer

## Improvements

- Enhanced search functionality
- Better mobile responsiveness
- Performance optimizations

## Bug Fixes

- Fixed duplicate note creation
- Resolved session timeout issues
- Fixed export file naming`,
      excerpt: 'Release notes for version 1.5.0.',
      categorySlug: 'changelogs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Troubleshooting Guide',
      slug: 'troubleshooting',
      content: `# Troubleshooting Guide

## Common Issues

### Login Problems

**Issue**: Cannot log in

**Solutions**:
1. Clear browser cache
2. Check caps lock
3. Reset password
4. Contact admin if locked out

### Note Not Saving

**Issue**: Changes not saved

**Solutions**:
1. Check internet connection
2. Look for error messages
3. Try refreshing the page
4. Save as draft first

### Recording Issues

**Issue**: Microphone not working

**Solutions**:
1. Check browser permissions
2. Test microphone in settings
3. Try different browser
4. Check hardware connections

### Slow Performance

**Issue**: Pages load slowly

**Solutions**:
1. Clear browser cache
2. Close unused tabs
3. Check internet speed
4. Contact support`,
      excerpt: 'Solutions for common issues and problems.',
      categorySlug: 'user-guides',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'API Rate Limits',
      slug: 'api-rate-limits',
      content: `# API Rate Limits

## Default Limits

| Tier | Requests/min | Requests/day |
|------|--------------|--------------|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | 1,000 | Unlimited |

## Rate Limit Headers

Each response includes:

\`\`\`
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
\`\`\`

## Handling 429 Errors

When rate limited:

1. Check Retry-After header
2. Implement exponential backoff
3. Cache responses where possible

## Best Practices

- Use webhooks instead of polling
- Batch requests when possible
- Cache frequently accessed data`,
      excerpt: 'Understanding and working with API rate limits.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Webhooks Integration',
      slug: 'webhooks-integration',
      content: `# Webhooks Integration

## Overview

Webhooks notify your application of events in real-time.

## Setup

1. Go to Settings > Webhooks
2. Click "Add Webhook"
3. Enter your endpoint URL
4. Select events to subscribe

## Events

| Event | Description |
|-------|-------------|
| note.created | New note created |
| note.signed | Note was signed |
| patient.updated | Patient info changed |

## Payload Format

\`\`\`json
{
  "event": "note.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "id": "note_123",
    "patientId": "P001"
  }
}
\`\`\`

## Security

- Verify webhook signatures
- Use HTTPS endpoints
- Respond quickly (< 5s)`,
      excerpt: 'Set up webhooks to receive real-time event notifications.',
      categorySlug: 'api-docs',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Testing Guide',
      slug: 'testing-guide',
      content: `# Testing Guide

## Running Tests

\`\`\`bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
\`\`\`

## Test Structure

\`\`\`
tests/
├── unit/
│   ├── components/
│   └── utils/
├── integration/
│   └── api/
└── e2e/
    └── flows/
\`\`\`

## Writing Tests

\`\`\`javascript
describe('Note Service', () => {
  it('should create a note', async () => {
    const note = await createNote({
      patientId: 'P001',
      content: { ... }
    });
    expect(note.id).toBeDefined();
  });
});
\`\`\`

## Coverage

Aim for 80% coverage minimum.`,
      excerpt: 'Guide to writing and running tests.',
      categorySlug: 'development',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Deployment Guide',
      slug: 'deployment-guide',
      content: `# Deployment Guide

## Environments

- **Development**: Local machine
- **Staging**: staging.healthcare.com
- **Production**: app.healthcare.com

## Deployment Steps

### 1. Build Application

\`\`\`bash
npm run build
\`\`\`

### 2. Run Migrations

\`\`\`bash
npm run db:migrate:deploy
\`\`\`

### 3. Deploy

Using Vercel:
\`\`\`bash
vercel --prod
\`\`\`

## Environment Variables

Required in production:
- DATABASE_URL
- JWT_SECRET
- OPENROUTER_API_KEY

## Monitoring

- Error tracking: Sentry
- Analytics: Vercel Analytics
- Logs: CloudWatch`,
      excerpt: 'How to deploy the application to production.',
      categorySlug: 'development',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Contributing Guidelines',
      slug: 'contributing',
      content: `# Contributing Guidelines

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Code Standards

- Use TypeScript
- Follow ESLint rules
- Write tests for new features
- Update documentation

## Commit Messages

Use conventional commits:

\`\`\`
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: improve code structure
\`\`\`

## Pull Request Process

1. Ensure tests pass
2. Update CHANGELOG
3. Request review
4. Squash and merge`,
      excerpt: 'Guidelines for contributing to the project.',
      categorySlug: 'development',
      status: 'DRAFT' as const,
    },
    {
      title: 'FAQ - Frequently Asked Questions',
      slug: 'faq',
      content: `# Frequently Asked Questions

## General

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, and Edge (latest versions).

**Q: Is the system HIPAA compliant?**
A: Yes, we implement all required HIPAA safeguards.

## Notes

**Q: Can I edit a signed note?**
A: No, but you can create an amendment.

**Q: How long are notes retained?**
A: Notes are retained for 7 years per HIPAA requirements.

## Recordings

**Q: What audio formats are supported?**
A: WebM, MP3, and WAV formats.

**Q: How long can recordings be?**
A: Up to 2 hours per recording.

## Technical

**Q: What's the API rate limit?**
A: See our Rate Limits documentation.

**Q: Is there a mobile app?**
A: The web app is mobile-responsive.`,
      excerpt: 'Answers to frequently asked questions.',
      categorySlug: 'user-guides',
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Internal: Team Processes',
      slug: 'internal-team-processes',
      content: `# Internal Team Processes

## Sprint Workflow

1. Sprint planning (Monday)
2. Daily standups (9 AM)
3. Sprint review (Friday)
4. Retrospective (Friday)

## Code Review

- All PRs require 2 approvals
- Use GitHub review features
- Address all comments

## On-Call Rotation

- Weekly rotation
- PagerDuty alerts
- Escalation procedures

## Documentation

- Update docs with features
- Keep CHANGELOG current
- Review quarterly`,
      excerpt: 'Internal team workflows and processes.',
      categorySlug: 'internal',
      status: 'DRAFT' as const,
    },
  ];

  for (const docData of sampleDocs) {
    const category = createdCategories.find(c => c.slug === docData.categorySlug);
    const doc = await prisma.doc.upsert({
      where: { slug: docData.slug },
      update: {},
      create: {
        title: docData.title,
        slug: docData.slug,
        content: docData.content,
        excerpt: docData.excerpt,
        status: docData.status,
        visibility: docData.status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE',
        authorId: adminUser.id,
        categoryId: category?.id,
        wordCount: docData.content.split(/\s+/).length,
        readingTime: Math.ceil(docData.content.split(/\s+/).length / 200),
        publishedAt: docData.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    // Create initial version (only if doc was just created)
    const existingVersion = await prisma.docVersion.findFirst({
      where: { docId: doc.id },
    });
    if (!existingVersion) {
      await prisma.docVersion.create({
        data: {
          docId: doc.id,
          version: 1,
          title: doc.title,
          content: doc.content,
          changelog: 'Initial creation',
          createdById: adminUser.id,
        },
      });
    }

    // Create search index (only if not exists)
    await prisma.docSearchIndex.upsert({
      where: { docId: doc.id },
      update: {},
      create: {
        docId: doc.id,
        searchVector: `${doc.title} ${doc.content} ${docData.excerpt || ''}`.toLowerCase(),
        titleVector: doc.title.toLowerCase(),
      },
    });

    // Add random tags (2-3 per doc) - skip if already has tags
    const existingTags = await prisma.docTagAssignment.count({ where: { docId: doc.id } });
    if (existingTags === 0) {
      const numTags = 2 + Math.floor(Math.random() * 2);
      const shuffledTags = [...createdTags].sort(() => Math.random() - 0.5).slice(0, numTags);
      for (const tag of shuffledTags) {
        await prisma.docTagAssignment.create({
          data: {
            docId: doc.id,
            tagId: tag.id,
          },
        });
      }
    }
  }
  console.log(`Created ${sampleDocs.length} sample documents with versions, search index, and tags`);

  // ==================== PASSWORD RESET TOKENS (15 items) ====================
  console.log('Creating password reset tokens...');
  const passwordResetTokens = [];
  for (let i = 0; i < 15; i++) {
    const targetUser = createdUsers[i % createdUsers.length];
    const daysAgo = i * 2;
    const token = await prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        token: `reset-token-${i + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() - (daysAgo > 5 ? 1 : -1) * 60 * 60 * 1000), // Some expired, some valid
        used: i < 8, // First 8 are used
        createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      },
    });
    passwordResetTokens.push(token);
  }
  console.log(`Created ${passwordResetTokens.length} password reset tokens`);

  // ==================== EMAIL VERIFICATIONS (15 items) ====================
  console.log('Creating email verifications...');
  const emailVerifications = [];
  for (let i = 0; i < 15; i++) {
    const targetUser = createdUsers[i % createdUsers.length];
    const verification = await prisma.emailVerification.create({
      data: {
        userId: targetUser.id,
        token: `verify-token-${i + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verified: i < 12, // Most are verified
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      },
    });
    emailVerifications.push(verification);
  }
  // Mark users with verified emails
  for (let i = 0; i < 12; i++) {
    const targetUser = createdUsers[i % createdUsers.length];
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { emailVerified: true },
    });
  }
  console.log(`Created ${emailVerifications.length} email verifications`);

  // ==================== RATE LIMIT ENTRIES (15 items) ====================
  console.log('Creating rate limit entries...');
  const rateLimitEntries = [];
  const ipAddresses = [
    '192.168.1.10', '192.168.1.11', '192.168.1.12', '10.0.0.1', '10.0.0.2',
    '172.16.0.1', '172.16.0.2', '172.16.0.3', '192.168.2.1', '192.168.2.2',
    '10.1.1.1', '10.1.1.2', '192.168.3.1', '192.168.3.2', '172.17.0.1',
  ];
  const apiEndpoints = [
    '/api/auth/login', '/api/notes', '/api/recordings', '/api/docs', '/api/users',
    '/api/auth/register', '/api/export/csv', '/api/bulk/delete', '/api/templates', '/api/settings',
    '/api/audit-logs', '/api/integrations', '/api/codes', '/api/docs/search', '/api/auth/forgot-password',
  ];
  for (let i = 0; i < 15; i++) {
    const key = `${ipAddresses[i]}:${apiEndpoints[i]}`;
    const data = {
        key,
        count: Math.floor(Math.random() * 50) + 1,
        windowStart: new Date(Date.now() - Math.floor(Math.random() * 60000)),
        expiresAt: new Date(Date.now() + 60000),
    };
    const entry = await prisma.rateLimitEntry.upsert({
      where: { key },
      update: data,
      create: data,
    });
    rateLimitEntries.push(entry);
  }
  console.log(`Created ${rateLimitEntries.length} rate limit entries`);

  // ==================== ADDITIONAL AUDIT LOGS for new features (15+ more) ====================
  console.log('Creating additional audit logs for new features...');
  const newFeatureAuditLogs = [
    { action: AuditAction.CREATE, entityType: 'User', description: 'User registration' },
    { action: AuditAction.UPDATE, entityType: 'User', description: 'Password reset' },
    { action: AuditAction.UPDATE, entityType: 'User', description: 'Email verification' },
    { action: AuditAction.EXPORT, entityType: 'Note', description: 'CSV export - notes' },
    { action: AuditAction.EXPORT, entityType: 'User', description: 'CSV export - users' },
    { action: AuditAction.EXPORT, entityType: 'AuditLog', description: 'CSV export - audit logs' },
    { action: AuditAction.EXPORT, entityType: 'Recording', description: 'CSV export - recordings' },
    { action: AuditAction.EXPORT, entityType: 'Doc', description: 'CSV export - docs' },
    { action: AuditAction.DELETE, entityType: 'Note', description: 'Bulk delete notes' },
    { action: AuditAction.DELETE, entityType: 'Recording', description: 'Bulk delete recordings' },
    { action: AuditAction.UPDATE, entityType: 'Note', description: 'Bulk update note status' },
    { action: AuditAction.UPDATE, entityType: 'Doc', description: 'Bulk update doc visibility' },
    { action: AuditAction.UPDATE, entityType: 'User', description: 'Bulk update user roles' },
    { action: AuditAction.LOGIN, entityType: 'User', description: 'Rate limited login attempt' },
    { action: AuditAction.ACCESS_DENIED, entityType: 'API', description: 'Rate limit exceeded' },
    { action: AuditAction.CREATE, entityType: 'User', description: 'New user registered via form' },
    { action: AuditAction.UPDATE, entityType: 'User', description: 'Password changed via reset' },
    { action: AuditAction.READ, entityType: 'Note', description: 'Note detail viewed' },
    { action: AuditAction.DELETE, entityType: 'Doc', description: 'Document deleted from modal' },
    { action: AuditAction.UPDATE, entityType: 'Note', description: 'Note edited from detail view' },
  ];
  for (let i = 0; i < newFeatureAuditLogs.length; i++) {
    const log = newFeatureAuditLogs[i];
    await prisma.auditLog.create({
      data: {
        userId: createdUsers[i % createdUsers.length].id,
        action: log.action,
        entityType: log.entityType,
        entityId: `feature-${i + 1}`,
        ipAddress: ipAddresses[i % ipAddresses.length],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        newValues: { description: log.description },
      },
    });
  }
  console.log(`Created ${newFeatureAuditLogs.length} additional audit logs for new features`);

  // ==================== ADDITIONAL SYSTEM SETTINGS for new features (15 items) ====================
  console.log('Creating additional system settings for new features...');
  const newFeatureSettings = [
    { key: 'registration_enabled', value: 'true', description: 'Allow new user registration' },
    { key: 'email_verification_required', value: 'true', description: 'Require email verification for new users' },
    { key: 'password_reset_expiry_minutes', value: '60', description: 'Password reset token expiry in minutes' },
    { key: 'csv_export_max_rows', value: '10000', description: 'Maximum rows in CSV export' },
    { key: 'bulk_operation_max_items', value: '100', description: 'Maximum items in bulk operations' },
    { key: 'rate_limit_window_ms', value: '60000', description: 'Rate limit window in milliseconds' },
    { key: 'rate_limit_max_requests', value: '60', description: 'Maximum requests per rate limit window' },
    { key: 'auth_rate_limit_max', value: '10', description: 'Max auth attempts per 15 minutes' },
    { key: 'toast_default_duration', value: '4000', description: 'Default toast notification duration in ms' },
    { key: 'confirm_dialog_enabled', value: 'true', description: 'Show confirmation dialogs for destructive actions' },
    { key: 'skeleton_loading_enabled', value: 'true', description: 'Show skeleton loaders during page load' },
    { key: 'form_validation_realtime', value: 'true', description: 'Enable real-time form validation' },
    { key: 'security_headers_enabled', value: 'true', description: 'Enable helmet security headers' },
    { key: 'input_sanitization_enabled', value: 'true', description: 'Enable input sanitization middleware' },
    { key: 'error_boundary_enabled', value: 'true', description: 'Enable React error boundaries' },
  ];
  for (const setting of newFeatureSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`Created ${newFeatureSettings.length} new feature settings`);

  // ==================== ADDITIONAL CO-SIGNATURES (15 items) ====================
  console.log('Creating co-signature records...');
  const allNotes = await prisma.note.findMany({ take: 15 });
  for (let i = 0; i < Math.min(15, allNotes.length); i++) {
    const requester = createdUsers[i % createdUsers.length];
    const signer = providers[(i + 1) % providers.length];
    if (requester.id !== signer.id) {
      try {
        await prisma.coSignature.create({
          data: {
            noteId: allNotes[i].id,
            requesterId: requester.id,
            signerId: signer.id,
            status: i < 8 ? 'SIGNED' : i < 12 ? 'PENDING' : 'REJECTED',
            comments: i < 8 ? 'Reviewed and approved' : i < 12 ? null : 'Needs corrections',
            signedAt: i < 8 ? new Date() : null,
          },
        });
      } catch (e) {
        // Skip if duplicate
      }
    }
  }
  console.log('Created co-signature records');

  // ==================== ADDITIONAL AMENDMENTS (15 items) ====================
  console.log('Creating amendment records...');
  for (let i = 0; i < Math.min(15, allNotes.length); i++) {
    const author = createdUsers[i % createdUsers.length];
    await prisma.amendment.create({
      data: {
        noteId: allNotes[i].id,
        userId: author.id,
        reason: [
          'Correcting vital signs documentation',
          'Adding missed medication information',
          'Updating diagnosis based on lab results',
          'Correcting patient history details',
          'Adding procedure details',
          'Updating treatment plan',
          'Correcting allergies information',
          'Adding follow-up instructions',
          'Updating discharge summary',
          'Correcting medication dosage',
          'Adding missed physical exam findings',
          'Updating imaging results',
          'Correcting referral information',
          'Adding patient education notes',
          'Updating insurance coding',
        ][i],
        oldContent: { text: `Original content version ${i + 1}` },
        newContent: { text: `Amended content version ${i + 1}` },
        status: i < 10 ? 'APPROVED' : i < 13 ? 'PENDING' : 'REJECTED',
        approvedBy: i < 10 ? providers[0].id : null,
        approvedAt: i < 10 ? new Date() : null,
      },
    });
  }
  console.log('Created 15 amendment records');

  // ==================== ADDITIONAL ACCESS CONTROLS (15 items) ====================
  console.log('Creating access control records...');
  const resources = [
    'notes:read', 'notes:write', 'notes:delete', 'notes:sign',
    'recordings:read', 'recordings:write', 'recordings:delete',
    'docs:read', 'docs:write', 'docs:delete',
    'users:read', 'users:write', 'users:delete',
    'settings:read', 'settings:write',
  ];
  const permissions = ['READ', 'WRITE', 'DELETE', 'SIGN', 'COSIGN', 'ADMIN'] as const;
  for (let i = 0; i < 15; i++) {
    const targetUser = createdUsers[i % createdUsers.length];
    try {
      await prisma.accessControl.create({
        data: {
          userId: targetUser.id,
          resource: resources[i],
          permission: permissions[i % permissions.length],
          grantedBy: createdUsers[0].id,
        },
      });
    } catch (e) {
      // Skip duplicates
    }
  }
  console.log('Created 15 access control records');

  // ==================== ADDITIONAL NOTE VERSIONS (15 items) ====================
  console.log('Creating additional note versions...');
  for (let i = 0; i < Math.min(15, allNotes.length); i++) {
    const note = allNotes[i];
    const existingVersions = await prisma.noteVersion.count({ where: { noteId: note.id } });
    await prisma.noteVersion.create({
      data: {
        noteId: note.id,
        version: existingVersions + 1,
        content: { text: `Updated content v${existingVersions + 1} - Review ${i + 1}` },
        changedBy: createdUsers[i % createdUsers.length].id,
        changeLog: [
          'Updated subjective section',
          'Added medication changes',
          'Updated vital signs',
          'Revised assessment',
          'Modified treatment plan',
          'Added lab results',
          'Updated imaging findings',
          'Corrected patient demographics',
          'Added specialist recommendations',
          'Updated follow-up plan',
          'Revised differential diagnosis',
          'Added procedure notes',
          'Updated family history',
          'Added social history details',
          'Revised physical exam findings',
        ][i],
      },
    });
  }
  console.log('Created 15 additional note versions');

  // ==================== ADDITIONAL MEDICAL CODES on notes (15 items) ====================
  console.log('Creating medical code assignments...');
  for (let i = 0; i < Math.min(15, allNotes.length); i++) {
    const note = allNotes[i];
    await prisma.medicalCode.create({
      data: {
        noteId: note.id,
        codeType: i % 2 === 0 ? 'CPT' : 'ICD10',
        code: i % 2 === 0 ? cptCodes[i % cptCodes.length].code : icd10Codes[i % icd10Codes.length].code,
        description: i % 2 === 0 ? cptCodes[i % cptCodes.length].description : icd10Codes[i % icd10Codes.length].description,
        confidence: 0.75 + Math.random() * 0.25,
        isVerified: i < 10,
        verifiedBy: i < 10 ? providers[i % providers.length].id : null,
      },
    });
  }
  console.log('Created 15 medical code assignments');

  // ==================== INTEGRATION SYNC LOGS (15 items) ====================
  console.log('Creating integration sync logs...');
  const allIntegrations = await prisma.integration.findMany({ take: 5 });
  for (let i = 0; i < 15; i++) {
    const integration = allIntegrations[i % allIntegrations.length];
    await prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: i < 10 ? 'COMPLETED' : i < 13 ? 'FAILED' : 'PARTIAL',
        recordsSync: Math.floor(Math.random() * 500) + 10,
        errors: i >= 10 ? { message: `Sync error for batch ${i + 1}`, code: 'TIMEOUT' } : undefined,
        startedAt: new Date(Date.now() - i * 4 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - i * 4 * 60 * 60 * 1000 + 120000),
      },
    });
  }
  console.log('Created 15 integration sync logs');

  console.log('');
  console.log('========================================');
  console.log('Database seeding completed successfully!');
  console.log('========================================');
  console.log('');
  console.log('Summary:');
  console.log(`  - ${specialties.length} Specialties`);
  console.log(`  - ${users.length} Users`);
  console.log(`  - ${templates.length} Note Templates`);
  console.log(`  - ${cptCodes.length + icd10Codes.length} Medical Codes`);
  console.log(`  - ${integrations.length} Integrations`);
  console.log('  - 20 Sample Notes');
  console.log('  - 20 Recordings');
  console.log('  - 20 Comments');
  console.log('  - 45 Audit Logs (25 + 20 new feature logs)');
  console.log(`  - ${retentionPolicies.length} Retention Policies`);
  console.log(`  - ${settings.length + newFeatureSettings.length} System Settings`);
  console.log(`  - ${docCategories.length} Doc Categories`);
  console.log(`  - ${docTags.length} Doc Tags`);
  console.log(`  - ${sampleDocs.length} Sample Documents`);
  console.log('  - 15 Password Reset Tokens');
  console.log('  - 15 Email Verifications');
  console.log('  - 15 Rate Limit Entries');
  console.log('  - 15 Co-Signatures');
  console.log('  - 15 Amendments');
  console.log('  - 15 Access Controls');
  console.log('  - 15 Note Versions (additional)');
  console.log('  - 15 Medical Code Assignments');
  console.log('  - 15 Integration Sync Logs');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
