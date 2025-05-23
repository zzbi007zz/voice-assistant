
import React from 'react';
import { GroundingChunk } from '../types';

interface SearchReferencesCardProps {
  references: GroundingChunk[];
}

export const SearchReferencesCard: React.FC<SearchReferencesCardProps> = ({ references }) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-slate-800 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-sky-400 mb-3">Sources / References:</h3>
      <ul className="space-y-2">
        {references.map((ref, index) => (
          <li key={index} className="text-sm">
            <a
              href={ref.web.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:text-sky-300 hover:underline transition-colors break-all"
              title={ref.web.uri}
            >
              {ref.web.title || ref.web.uri}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
