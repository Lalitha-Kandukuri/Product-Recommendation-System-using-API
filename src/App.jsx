import React, { useState } from 'react';
import { products } from './data/products';
import { getRecommendations, streamText } from './services/aiService';
import AiQueryCard from './components/AiQueryCard';
import ProductList from './components/ProductList';

export default function App() {
  // Catalog States
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Run DeepSeek AI Search Query
  const handleAiSearch = async (query) => {
    setIsLoading(true);
    setAiExplanation("");

    try {
      const response = await getRecommendations(query);
      
      // Strict matching: Filter product grid to ONLY matching items
      const matchingIds = response.recommendedIds;
      const filtered = products.filter(p => matchingIds.includes(p.id));
      setFilteredProducts(filtered);
      
      // Stream explanation paragraph
      streamText(
        response.explanation, 
        (streamedText) => {
          setAiExplanation(streamedText);
        },
        10
      );
      
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setAiExplanation(`⚠️ Error: ${error.message || "Failed to retrieve recommendations."}`);
      setFilteredProducts(products);
    }
  };

  // Reset search and show full catalog
  const handleClearFocus = () => {
    setFilteredProducts(products);
    setAiExplanation("");
  };

  const formatExplanation = (text) => {
    if (!text) return "";
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index}>{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="app-container">

      {/* Main AI Product Recommender Header & Input Box */}
      <AiQueryCard 
        onQuerySubmit={handleAiSearch} 
        isLoading={isLoading} 
      />

      {/* Clean, Simple Recommendation Explanation Text */}
      {aiExplanation && (
        <div className="ai-explanation-box">
          <div className="ai-explanation-text">
            <span>💡 <strong>Recommendation:</strong> {formatExplanation(aiExplanation)}</span>
            <button className="btn-clear-ai" onClick={handleClearFocus}>
              Clear Filter
            </button>
          </div>
        </div>
      )}

      {/* Product Catalog Section */}
      <div className="catalog-section">
        <h2 className="catalog-title">Catalog</h2>
        <ProductList products={filteredProducts} />
      </div>

    </div>
  );
}
