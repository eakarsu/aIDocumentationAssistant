import type { NextApiRequest, NextApiResponse } from 'next';

// All enums from Prisma schema - single source of truth
export const enums = {
  UserRole: [
    { value: 'ADMIN', label: 'Administrator' },
    { value: 'PROVIDER', label: 'Provider' },
    { value: 'NURSE', label: 'Nurse' },
    { value: 'MEDICAL_ASSISTANT', label: 'Medical Assistant' },
    { value: 'BILLING_STAFF', label: 'Billing Staff' },
    { value: 'AUDITOR', label: 'Auditor' },
  ],
  NoteType: [
    { value: 'SOAP', label: 'SOAP Note' },
    { value: 'PROGRESS', label: 'Progress Note' },
    { value: 'CONSULTATION', label: 'Consultation' },
    { value: 'PROCEDURE', label: 'Procedure Note' },
    { value: 'ADMISSION', label: 'Admission Note' },
    { value: 'DISCHARGE', label: 'Discharge Summary' },
    { value: 'OPERATIVE', label: 'Operative Report' },
    { value: 'EMERGENCY', label: 'Emergency Note' },
    { value: 'FOLLOWUP', label: 'Follow-up Note' },
    { value: 'TELEHEALTH', label: 'Telehealth Visit' },
  ],
  NoteStatus: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PENDING_REVIEW', label: 'Pending Review' },
    { value: 'PENDING_COSIGN', label: 'Pending Co-sign' },
    { value: 'SIGNED', label: 'Signed' },
    { value: 'AMENDED', label: 'Amended' },
    { value: 'LOCKED', label: 'Locked' },
  ],
  FieldType: [
    { value: 'TEXT', label: 'Text' },
    { value: 'TEXTAREA', label: 'Text Area' },
    { value: 'SELECT', label: 'Select' },
    { value: 'MULTISELECT', label: 'Multi-select' },
    { value: 'CHECKBOX', label: 'Checkbox' },
    { value: 'DATE', label: 'Date' },
    { value: 'TIME', label: 'Time' },
    { value: 'NUMBER', label: 'Number' },
    { value: 'VITALS', label: 'Vitals' },
    { value: 'DIAGNOSIS', label: 'Diagnosis' },
    { value: 'MEDICATION', label: 'Medication' },
  ],
  RecordingType: [
    { value: 'AUDIO', label: 'Audio' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'SCREEN', label: 'Screen' },
  ],
  RecordingStatus: [
    { value: 'UPLOADING', label: 'Uploading' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'TRANSCRIBING', label: 'Transcribing' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'FAILED', label: 'Failed' },
  ],
  AmendmentStatus: [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ],
  CoSignStatus: [
    { value: 'PENDING', label: 'Pending' },
    { value: 'SIGNED', label: 'Signed' },
    { value: 'REJECTED', label: 'Rejected' },
  ],
  CodeType: [
    { value: 'CPT', label: 'CPT' },
    { value: 'ICD10', label: 'ICD-10' },
    { value: 'HCPCS', label: 'HCPCS' },
    { value: 'SNOMED', label: 'SNOMED' },
  ],
  AuditAction: [
    { value: 'CREATE', label: 'Create' },
    { value: 'READ', label: 'Read' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'SIGN', label: 'Sign' },
    { value: 'COSIGN', label: 'Co-sign' },
    { value: 'AMEND', label: 'Amend' },
    { value: 'EXPORT', label: 'Export' },
    { value: 'PRINT', label: 'Print' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'ACCESS_DENIED', label: 'Access Denied' },
  ],
  EntityType: [
    { value: 'User', label: 'User' },
    { value: 'Note', label: 'Note' },
    { value: 'NoteTemplate', label: 'Note Template' },
    { value: 'Recording', label: 'Recording' },
    { value: 'Integration', label: 'Integration' },
    { value: 'Comment', label: 'Comment' },
    { value: 'Amendment', label: 'Amendment' },
    { value: 'CoSignature', label: 'Co-signature' },
    { value: 'MedicalCode', label: 'Medical Code' },
    { value: 'SystemSetting', label: 'System Setting' },
  ],
  IntegrationType: [
    { value: 'EHR', label: 'EHR System' },
    { value: 'PRACTICE_MANAGEMENT', label: 'Practice Management' },
    { value: 'BILLING', label: 'Billing System' },
    { value: 'LAB', label: 'Laboratory' },
    { value: 'PHARMACY', label: 'Pharmacy' },
    { value: 'IMAGING', label: 'Imaging' },
  ],
  IntegrationStatus: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'ERROR', label: 'Error' },
    { value: 'SYNCING', label: 'Syncing' },
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow fetching specific enum type via query param
  const { type } = req.query;

  if (type && typeof type === 'string') {
    if (enums[type as keyof typeof enums]) {
      return res.status(200).json(enums[type as keyof typeof enums]);
    }
    return res.status(404).json({ error: `Enum type '${type}' not found` });
  }

  // Return all enums
  res.status(200).json(enums);
}
