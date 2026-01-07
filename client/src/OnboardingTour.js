import React, { useState, useEffect } from 'react';
import './OnboardingTour.css';

function OnboardingTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const tourSteps = [
    {
      title: "Welcome to Krapter Converter!",
      description: "Let's walk you through the key features. First, upload your image by dragging it into the upload area or clicking to browse.",
      highlight: ".upload-section",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=200&fit=crop"
    },
    {
      title: "Choose Your Quality",
      description: "Select from 4 quality levels - Low for web, Medium for balance, High for quality, or Lossless for maximum quality.",
      highlight: ".quality-section",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=200&fit=crop"
    },
    {
      title: "Quick Format Presets",
      description: "Use our preset templates for Instagram, Facebook, YouTube, or other popular formats. One click to perfect dimensions!",
      highlight: ".presets-section",
      image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=200&fit=crop"
    },
    {
      title: "Advanced Editing Tools",
      description: "Access powerful editing features like resize, rotate, filters, watermarks, and metadata controls in the advanced section.",
      highlight: ".advanced-toggle",
      image: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=400&h=200&fit=crop"
    },
    {
      title: "Convert & Download",
      description: "Hit convert to process your images with all selected settings. Download individually, as ZIP, or create PDFs!",
      highlight: ".convert-btn",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop"
    }
  ];

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    localStorage.setItem('hasSeenTour', 'true');
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  if (!isVisible) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="onboarding-overlay">
      {/* Background blur */}
      <div className="onboarding-backdrop" />
      
      {/* Spotlight highlight */}
      <div className="spotlight-highlight" />
      
      {/* Tour card */}
      <div className="tour-card glass-card">
        <div className="tour-content">
          {/* Tour image */}
          <div 
            className="tour-image"
            style={{ backgroundImage: `url(${currentTourStep.image})` }}
          />
          
          {/* Tour text */}
          <div className="tour-text">
            <h2 className="tour-title">{currentTourStep.title}</h2>
            <p className="tour-description">{currentTourStep.description}</p>
          </div>
        </div>
        
        {/* Progress dots */}
        <div className="tour-progress">
          <div className="progress-dots">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                className={`progress-dot ${index === currentStep ? 'active' : ''}`}
                onClick={() => goToStep(index)}
              />
            ))}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="tour-actions">
          <button className="tour-btn skip-btn" onClick={handleSkip}>
            Skip Tour
          </button>
          <button className="tour-btn next-btn" onClick={handleNext}>
            {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
            {currentStep < tourSteps.length - 1 && <span className="arrow">→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;