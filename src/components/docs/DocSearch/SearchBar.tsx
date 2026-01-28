import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '@/lib/api';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ placeholder = 'Search docs...', className = '' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        search();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  const search = async () => {
    setLoading(true);
    try {
      const data = await api.searchDocs({ q: query, limit: '5' });
      setResults(data.docs);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= 2) {
      router.push(`/docs/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {loading && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </form>

      {/* Dropdown Results */}
      {showDropdown && (query.length >= 2) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {loading ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {results.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/docs/${doc.id}`}
                      onClick={() => setShowDropdown(false)}
                      className="block p-3 hover:bg-gray-50"
                    >
                      <p
                        className="font-medium text-gray-900"
                        dangerouslySetInnerHTML={{ __html: doc.highlightedTitle }}
                      />
                      {doc.highlightedExcerpt && (
                        <p
                          className="text-sm text-gray-500 mt-1 line-clamp-1"
                          dangerouslySetInnerHTML={{ __html: doc.highlightedExcerpt }}
                        />
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          doc.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {doc.status}
                        </span>
                        {doc.category && (
                          <span className="text-xs text-gray-400">{doc.category.name}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="p-2 border-t border-gray-100">
                <button
                  onClick={handleSubmit}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  View all results for "{query}"
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        mark {
          background-color: #fef08a;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
