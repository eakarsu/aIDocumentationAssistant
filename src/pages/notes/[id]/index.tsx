import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';

export default function NoteDetailPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [note, setNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSigner, setSelectedSigner] = useState('');
  const [showCosignModal, setShowCosignModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [aiResult, setAiResult] = useState<{ type: string; data: any } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadNote();
      loadUsers();
    }
  }, [isAuthenticated, id]);

  const loadNote = async () => {
    try {
      const data = await api.getNote(id as string);
      setNote(data);
    } catch (error) {
      console.error('Failed to load note:', error);
      router.push('/notes');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getUsers({ role: 'PROVIDER' });
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleSign = async () => {
    if (!confirm('Are you sure you want to sign this note? This action cannot be undone.')) return;

    try {
      await api.signNote(id as string);
      loadNote();
    } catch (error: any) {
      alert(error.message || 'Failed to sign note');
    }
  };

  const handleRequestCosign = async () => {
    if (!selectedSigner) {
      alert('Please select a co-signer');
      return;
    }

    try {
      await api.requestCosign(id as string, selectedSigner);
      setShowCosignModal(false);
      setSelectedSigner('');
      loadNote();
    } catch (error: any) {
      alert(error.message || 'Failed to request co-signature');
    }
  };

  const handleRespondCosign = async (action: string) => {
    try {
      await api.respondCosign(id as string, action);
      loadNote();
    } catch (error: any) {
      alert(error.message || 'Failed to respond to co-signature');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await api.addComment(id as string, newComment);
      setNewComment('');
      setShowCommentModal(false);
      loadNote();
    } catch (error: any) {
      alert(error.message || 'Failed to add comment');
    }
  };

  const handleAIAction = async (action: string) => {
    setAiLoading(action);
    try {
      switch (action) {
        case 'summarize':
          const summary = await api.summarizeNote(id as string);
          setAiResult({ type: 'summary', data: summary });
          break;
        case 'codes':
          const codes = await api.suggestCodes(id as string);
          setAiResult({ type: 'codes', data: codes });
          break;
        case 'quality':
          const quality = await api.qualityCheck(id as string);
          setAiResult({ type: 'quality', data: quality });
          break;
      }
      loadNote();
    } catch (error: any) {
      setAiResult({ type: 'error', data: { message: error.message || 'AI action failed' } });
    } finally {
      setAiLoading(null);
    }
  };

  if (isLoading || !isAuthenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <Layout>
        <div className="text-center py-8">Note not found</div>
      </Layout>
    );
  }

  const isAuthor = note.authorId === user?.id;
  const pendingCosign = note.coSignatures?.find((cs: any) => cs.signerId === user?.id && cs.status === 'PENDING');
  const canEdit = isAuthor && note.status === 'DRAFT';
  const canSign = isAuthor && ['DRAFT', 'PENDING_REVIEW'].includes(note.status);
  const canRequestCosign = isAuthor && ['DRAFT', 'PENDING_REVIEW'].includes(note.status);

  const templateSections = note.template?.sections || [];
  const content = note.content || {};

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{note.patientName}</h1>
            <span className={`badge ${
              note.status === 'SIGNED' ? 'badge-green' :
              note.status === 'DRAFT' ? 'badge-yellow' :
              'badge-gray'
            }`}>
              {note.status}
            </span>
          </div>
          <p className="text-gray-600">
            Patient ID: {note.patientId} | {note.noteType} |
            {new Date(note.encounterDate).toLocaleDateString()}
          </p>
        </div>

        <div className="flex space-x-2">
          {canEdit && (
            <Link href={`/notes/${id}/edit`} className="btn btn-primary">
              Edit
            </Link>
          )}
          {canSign && (
            <button onClick={handleSign} className="btn btn-success">
              Sign Note
            </button>
          )}
          {canRequestCosign && (
            <button onClick={() => setShowCosignModal(true)} className="btn btn-outline">
              Request Co-sign
            </button>
          )}
          {pendingCosign && (
            <>
              <button onClick={() => handleRespondCosign('SIGNED')} className="btn btn-success">
                Co-sign
              </button>
              <button onClick={() => handleRespondCosign('REJECTED')} className="btn btn-danger">
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Note Content */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Note Content</h2>
            {templateSections.length > 0 ? (
              <div className="space-y-4">
                {templateSections.map((section: any) => (
                  <div key={section.id} className="border-b pb-4 last:border-0">
                    <h3 className="font-medium text-gray-900 mb-2">{section.name}</h3>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {content[section.id] ? (
                        typeof content[section.id] === 'object' ? (
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(content[section.id]).map(([key, value]) => (
                              <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600 capitalize">{key}:</span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          content[section.id]
                        )
                      ) : (
                        <span className="text-gray-400">Not documented</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No template sections defined</div>
            )}
          </div>

          {/* AI Summary */}
          {note.aiSummary && (
            <div className="card bg-blue-50">
              <h2 className="text-lg font-semibold mb-2 flex items-center">
                <span className="mr-2">AI Summary</span>
                <span className="badge badge-blue text-xs">AI Generated</span>
              </h2>
              <p className="text-gray-700">{note.aiSummary}</p>
            </div>
          )}

          {/* Comments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Comments</h2>
              <button
                onClick={() => setShowCommentModal(true)}
                className="btn btn-outline text-sm"
              >
                Add Comment
              </button>
            </div>
            {note.comments?.length > 0 ? (
              <div className="space-y-4">
                {note.comments.map((comment: any) => (
                  <div key={comment.id} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="font-medium">{comment.user.firstName} {comment.user.lastName}</span>
                      <span>•</span>
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      {comment.isResolved && <span className="badge badge-green text-xs">Resolved</span>}
                    </div>
                    <p className="mt-1 text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No comments yet</p>
            )}
          </div>

          {/* Amendments */}
          {note.amendments?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Amendments</h2>
              <div className="space-y-4">
                {note.amendments.map((amendment: any) => (
                  <div key={amendment.id} className="border-l-4 border-orange-500 pl-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="font-medium">{amendment.user.firstName} {amendment.user.lastName}</span>
                      <span>•</span>
                      <span>{new Date(amendment.createdAt).toLocaleString()}</span>
                      <span className={`badge ${
                        amendment.status === 'APPROVED' ? 'badge-green' :
                        amendment.status === 'REJECTED' ? 'badge-red' :
                        'badge-yellow'
                      } text-xs`}>
                        {amendment.status}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-700">{amendment.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">AI Features</h2>
            <div className="space-y-2">
              <button
                onClick={() => handleAIAction('summarize')}
                disabled={aiLoading !== null}
                className="btn btn-outline w-full justify-start"
              >
                {aiLoading === 'summarize' ? <div className="spinner mr-2"></div> : null}
                Generate Summary
              </button>
              <button
                onClick={() => handleAIAction('codes')}
                disabled={aiLoading !== null}
                className="btn btn-outline w-full justify-start"
              >
                {aiLoading === 'codes' ? <div className="spinner mr-2"></div> : null}
                Suggest Medical Codes
              </button>
              <button
                onClick={() => handleAIAction('quality')}
                disabled={aiLoading !== null}
                className="btn btn-outline w-full justify-start"
              >
                {aiLoading === 'quality' ? <div className="spinner mr-2"></div> : null}
                Quality Check
              </button>
            </div>
          </div>

          {/* Medical Codes */}
          {note.medicalCodes?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Medical Codes</h2>
              <div className="space-y-2">
                {note.medicalCodes.map((code: any) => (
                  <div key={code.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-mono font-medium">{code.code}</span>
                      <span className="text-xs text-gray-500 ml-2">{code.codeType}</span>
                    </div>
                    {code.isVerified && <span className="badge badge-green text-xs">Verified</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Version History */}
          {note.versions?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Version History</h2>
              <div className="space-y-2">
                {note.versions.map((version: any) => (
                  <div key={version.id} className="text-sm p-2 bg-gray-50 rounded">
                    <div className="font-medium">Version {version.version}</div>
                    <div className="text-gray-500">{new Date(version.createdAt).toLocaleString()}</div>
                    {version.changeLog && (
                      <div className="text-gray-600 mt-1">{version.changeLog}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Co-signatures */}
          {note.coSignatures?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Co-signatures</h2>
              <div className="space-y-2">
                {note.coSignatures.map((cs: any) => (
                  <div key={cs.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{cs.signer.firstName} {cs.signer.lastName}</span>
                    <span className={`badge ${
                      cs.status === 'SIGNED' ? 'badge-green' :
                      cs.status === 'REJECTED' ? 'badge-red' :
                      'badge-yellow'
                    } text-xs`}>
                      {cs.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Note Information</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Author</dt>
                <dd>{note.author?.firstName} {note.author?.lastName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Template</dt>
                <dd>{note.template?.name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{new Date(note.createdAt).toLocaleString()}</dd>
              </div>
              {note.signedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Signed</dt>
                  <dd>{new Date(note.signedAt).toLocaleString()}</dd>
                </div>
              )}
              {note.aiQualityScore && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Quality Score</dt>
                  <dd className="font-medium">{note.aiQualityScore}/100</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Co-sign Modal */}
      {showCosignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Request Co-signature</h3>
            <div className="mb-4">
              <label className="label">Select Co-signer</label>
              <select
                className="input"
                value={selectedSigner}
                onChange={(e) => setSelectedSigner(e.target.value)}
              >
                <option value="">Select a provider...</option>
                {users.filter(u => u.id !== user?.id).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} - {u.specialty || 'No specialty'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowCosignModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleRequestCosign} className="btn btn-primary">
                Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Comment</h3>
            <textarea
              className="input min-h-[100px]"
              placeholder="Enter your comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setShowCommentModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleAddComment} className="btn btn-primary">
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Modal */}
      {aiResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 ${
              aiResult.type === 'error' ? 'bg-red-500' :
              aiResult.type === 'summary' ? 'bg-blue-500' :
              aiResult.type === 'codes' ? 'bg-green-500' :
              'bg-purple-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    {aiResult.type === 'error' && (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {aiResult.type === 'summary' && (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {aiResult.type === 'codes' && (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    )}
                    {aiResult.type === 'quality' && (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {aiResult.type === 'error' && 'Error'}
                    {aiResult.type === 'summary' && 'AI Summary'}
                    {aiResult.type === 'codes' && 'Medical Codes'}
                    {aiResult.type === 'quality' && 'Quality Check'}
                  </h3>
                </div>
                <button
                  onClick={() => setAiResult(null)}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
              {/* Error */}
              {aiResult.type === 'error' && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-gray-700 text-lg">{aiResult.data.message}</p>
                </div>
              )}

              {/* Summary */}
              {aiResult.type === 'summary' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h4>
                    <p className="text-gray-800 text-lg leading-relaxed bg-blue-50 p-4 rounded-lg">
                      {aiResult.data.summary}
                    </p>
                  </div>
                  {aiResult.data.keyPoints?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Points</h4>
                      <ul className="space-y-2">
                        {aiResult.data.keyPoints.map((point: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3">
                              {idx + 1}
                            </span>
                            <span className="text-gray-700">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.data.followUps?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Follow-ups</h4>
                      <ul className="space-y-2">
                        {aiResult.data.followUps.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-center text-gray-700">
                            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Medical Codes */}
              {aiResult.type === 'codes' && (
                <div className="space-y-4">
                  {aiResult.data.codes?.length > 0 ? (
                    aiResult.data.codes.map((code: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              code.codeType === 'CPT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {code.codeType}
                            </span>
                            <span className="text-xl font-mono font-bold text-gray-900">{code.code}</span>
                          </div>
                          {code.confidence && (
                            <div className="flex items-center space-x-1">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    code.confidence >= 0.8 ? 'bg-green-500' :
                                    code.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${code.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500">{Math.round(code.confidence * 100)}%</span>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-gray-600">{code.description}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">No medical codes suggested</div>
                  )}
                </div>
              )}

              {/* Quality Check */}
              {aiResult.type === 'quality' && (
                <div className="space-y-6">
                  {/* Score */}
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                        <circle
                          cx="64" cy="64" r="56"
                          stroke={aiResult.data.score >= 80 ? '#22c55e' : aiResult.data.score >= 60 ? '#eab308' : '#ef4444'}
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(aiResult.data.score / 100) * 352} 352`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-gray-900">{aiResult.data.score}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Quality Score</p>
                  </div>

                  {/* Issues */}
                  {aiResult.data.issues?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Issues Found</h4>
                      <div className="space-y-2">
                        {aiResult.data.issues.map((issue: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border-l-4 ${
                              issue.severity === 'error'
                                ? 'bg-red-50 border-red-500'
                                : 'bg-yellow-50 border-yellow-500'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs font-semibold uppercase ${
                                issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="text-gray-500">•</span>
                              <span className="font-medium text-gray-800">{issue.field}</span>
                            </div>
                            <p className="mt-1 text-gray-600">{issue.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {aiResult.data.suggestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Suggestions</h4>
                      <ul className="space-y-2">
                        {aiResult.data.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx} className="flex items-start text-gray-700 bg-purple-50 p-3 rounded-lg">
                            <svg className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <div className="flex justify-center">
                <button
                  onClick={() => setAiResult(null)}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
