import React, { useState, useEffect } from 'react';
import { Sparkles, Sliders, X, Key, Info, HelpCircle } from 'lucide-react';
import { products } from './data/products';
import { getRecommendations, streamText } from './services/aiService';
import AiQueryCard from './components/AiQueryCard';
import ProductList from './components/ProductList';

export default function App() {
  // AI Settings (Saved in localStorage)
  const [provider, setProvider] = useState(() => {
    return localStorage.getItem('aura_provider') || 'local';
  });
  const [apiKey, setApiKey] = useState(() => {
    const activeProvider = localStorage.getItem('aura_provider') || 'local';
    return localStorage.getItem(`aura_key_${activeProvider}`) || '';
  });
  
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempProvider, setTempProvider] = useState(provider);
  const [showSettings, setShowSettings] = useState(false);

  // Catalog States
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);

  // Sync settings when provider changes
  useEffect(() => {
    const storedKey = localStorage.getItem(`aura_key_${tempProvider}`) || '';
    setTempKey(storedKey);
  }, [tempProvider]);

  // Save Settings
  const handleSaveSettings = () => {
    localStorage.setItem('aura_provider', tempProvider);
    localStorage.setItem(`aura_key_${tempProvider}`, tempKey);
    setProvider(tempProvider);
    setApiKey(tempKey);
    setShowSettings(false);
  };

  // Run AI Search Query
  const handleAiSearch = async (query) => {
    setIsLoading(true);
    setAiExplanation("");
    setIsAiActive(true);

    try {
      const response = await getRecommendations(query, provider, apiKey);
      
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
    setIsAiActive(false);
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

  const getProviderText = () => {
    if (provider === 'gemini') return 'Gemini Cloud API';
    if (provider === 'openai') return 'OpenAI GPT API';
    return 'Local Smart Matching';
  };

  return (
    <div className="app-container">
      
      {/* Settings Gear Overlay Toggle */}
      <div style={{ alignSelf: 'flex-end', marginBottom: '-1rem', zIndex: 10 }}>
        <button 
          className="btn-settings" 
          onClick={() => {
            setTempProvider(provider);
            setTempKey(apiKey);
            setShowSettings(true);
          }}
          title="Configure API Keys"
        >
          <Sliders size={14} />
          <span style={{ fontSize: '0.78rem', marginLeft: '0.25rem' }}>{getProviderText()}</span>
        </button>
      </div>

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

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-modal">
            
            <button 
              className="btn-close-modal" 
              onClick={() => setShowSettings(false)}
            >
              <X size={18} />
            </button>

            <h3>API Configurations</h3>

            <div className="setting-row">
              <label>AI Provider</label>
              <div className="provider-selector">
                <button 
                  className={`provider-btn ${tempProvider === 'local' ? 'active' : ''}`}
                  onClick={() => setTempProvider('local')}
                >
                  Local
                </button>
                
                <button 
                  className={`provider-btn ${tempProvider === 'gemini' ? 'active' : ''}`}
                  onClick={() => setTempProvider('gemini')}
                >
                  Gemini
                </button>

                <button 
                  className={`provider-btn ${tempProvider === 'openai' ? 'active' : ''}`}
                  onClick={() => setTempProvider('openai')}
                >
                  OpenAI
                </button>
              </div>
            </div>

            {tempProvider !== 'local' && (
              <div className="setting-row">
                <label>
                  {tempProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                </label>
                <input 
                  type="password" 
                  placeholder={tempProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                  className="settings-input"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                />
              </div>
            )}

            <div className="api-note">
              <Info size={13} style={{ marginRight: '0.2rem', verticalAlign: 'middle' }} />
              <span>
                {tempProvider === 'local' 
                  ? 'Uses client-side regex parsing for strictly filtering items on price & category constraint queries.' 
                  : 'API keys are stored directly in your local browser storage.'}
              </span>
            </div>

            <button className="btn-save-settings" onClick={handleSaveSettings}>
              Apply Configurations
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
