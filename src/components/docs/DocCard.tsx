import React from 'react';
import Link from 'next/link';

interface DocCardProps {
  doc: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    status: string;
    visibility: string;
    readingTime?: number;
    updatedAt: string;
    publishedAt?: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
    };
    category?: {
      id: string;
      name: string;
      slug: string;
      color?: string;
    };
    tags?: Array<{
      tag: {
        id: string;
        name: string;
        slug: string;
        color?: string;
      };
    }>;
    _count?: {
      comments: number;
      versions: number;
    };
  };
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export default function DocCard({ doc, onDelete, showActions = true }: DocCardProps) {
  const statusColors: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-800',
  };

  const visibilityIcons: Record<string, JSX.Element> = {
    PRIVATE: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    INTERNAL: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    PUBLIC: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <Link href={`/docs/${doc.id}`} className="group flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
              {doc.title}
            </h3>
          </Link>
          <div className="flex items-center ml-2 space-x-2">
            <span className="text-gray-400" title={doc.visibility}>
              {visibilityIcons[doc.visibility]}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[doc.status]}`}>
              {doc.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {doc.excerpt && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.excerpt}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {doc.category && (
            <Link
              href={`/docs?category=${doc.category.id}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {doc.category.color && (
                <span
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: doc.category.color }}
                />
              )}
              {doc.category.name}
            </Link>
          )}
          {doc.tags?.slice(0, 3).map(({ tag }) => (
            <Link
              key={tag.id}
              href={`/docs?tag=${tag.slug}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {tag.name}
            </Link>
          ))}
          {doc.tags && doc.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{doc.tags.length - 3} more</span>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {doc.author.firstName} {doc.author.lastName}
            </span>
            {doc.readingTime && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {doc.readingTime} min read
              </span>
            )}
          </div>
          <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
        </div>

        {doc._count && (
          <div className="flex items-center mt-3 pt-3 border-t border-gray-100 space-x-4 text-xs text-gray-400">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {doc._count.comments} comments
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              v{doc._count.versions}
            </span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
          <Link
            href={`/docs/${doc.id}/edit`}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/docs/${doc.id}/versions`}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            History
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
