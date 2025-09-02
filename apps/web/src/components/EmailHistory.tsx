"use client";

import { useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';

interface EmailAttachment {
  id: string;
  url_thumbnail: string;
  url_original: string;
}

interface EmailMessage {
  id: string;
  id_user_from: string;
  id_user_to: string;
  id_correspondence: string;
  content: string;
  title: string;
  date_created: string;
  date_read: string;
  is_paid: boolean;
  is_sent: string;
  is_deleted: string;
  status: string;
  attachments: {
    images: EmailAttachment[];
    videos: any[];
  };
}

interface EmailHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  clientId: string;
  correspondenceId: string;
}

export default function EmailHistory({ isOpen, onClose, profileId, clientId, correspondenceId }: EmailHistoryProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (isOpen && correspondenceId) {
      loadEmails();
    }
  }, [isOpen, correspondenceId, page]);

  const loadEmails = async () => {
    if (!correspondenceId) return;

    setLoading(true);
    try {
      const response = await apiPost('/api/tt/emails-history', {
        id_user: profileId,
        id_interlocutor: clientId,
        id_correspondence: correspondenceId,
        page: page,
        limit: 10,
        without_translation: false
      });

      if (response.success && response.data?.data?.history) {
        setEmails(prev => page === 1 ? response.data.data.history : [...prev, ...response.data.data.history]);
        setHasMore(response.data.data.history.length === 10);
      }
    } catch (error) {
      console.error('Failed to load email history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uk-UA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">📧 Історія листування</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {emails.length === 0 && !loading ? (
            <div className="text-center text-gray-500 py-8">
              📭 Немає листів в цій кореспонденції
            </div>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => (
                <div key={email.id} className="bg-gray-50 rounded-lg p-4 border">
                  {/* Email Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {email.title || 'Без теми'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Від: {email.id_user_from}</span>
                        <span>До: {email.id_user_to}</span>
                        <span>{formatDate(email.date_created)}</span>
                        {email.is_paid && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                            💰 Платний
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        email.status === 'read'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {email.status === 'read' ? 'Прочитано' : 'Непрочитано'}
                      </span>
                    </div>
                  </div>

                  {/* Email Content */}
                  <div
                    className="text-gray-800 mb-3 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.content }}
                  />

                  {/* Attachments */}
                  {email.attachments?.images && email.attachments.images.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">📎 Вкладення:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {email.attachments.images.map((image) => (
                          <div key={image.id} className="relative group">
                            <img
                              src={image.url_thumbnail}
                              alt="Attachment"
                              className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(image.url_original, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  <span className="ml-2 text-gray-600">Завантаження...</span>
                </div>
              )}

              {/* Load more button */}
              {!loading && hasMore && emails.length > 0 && (
                <div className="text-center py-4">
                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    Завантажити більше
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

