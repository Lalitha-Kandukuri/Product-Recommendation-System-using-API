import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function AiQueryCard({ onQuerySubmit, isLoading }) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onQuerySubmit(inputValue);
  };

  return (
    <div className="recommender-header-section">
      <h1 className="recommender-title">AI Product Recommender</h1>
      <p className="recommender-subtitle">
        Tell me what you're looking for — e.g. "I want a phone under $500" — and I'll pick from the catalog.
      </p>

      <form onSubmit={handleSubmit} className="recommender-input-row">
        <input
          type="text"
          className="recommender-input"
          placeholder='Try: "noise-cancelling headphones under $300"'
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="btn-recommend"
          disabled={isLoading || !inputValue.trim()}
        >
          <Sparkles size={16} />
          {isLoading ? "Thinking..." : "Recommend"}
        </button>
      </form>
    </div>
  );
}
