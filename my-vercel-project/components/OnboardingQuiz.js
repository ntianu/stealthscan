import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/auth';

function OnboardingQuiz() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchQuizQuestions = async () => {
      // For demonstration, we'll use a hardcoded quiz for now.
      // In a real application, this could be fetched from a JSON file or database.
      const hardcodedQuiz = [
        {
          id: 1,
          text: "What is your favourite colour?",
          options: ["Red", "Blue", "Green", "Other"],
          personaWeights: {
            Minimalist: 0,
            Bohemian: 1,
            Classic: 0,
          },
        },
        {
          id: 2,
          text: "What best describes your lifestyle?",
          options: ["Fast-paced", "Relaxed", "Balanced"],
          personaWeights: {
            Minimalist: 1,
            Bohemian: 0,
            Classic: 0,
          },
        },
      ];

      setQuestions(hardcodedQuiz);
      setLoading(false);
    };

    fetchQuizQuestions();
  }, []);

  const handleAnswerChange = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = async () => {
    calculateAndSavePersona();
  };

  const calculateAndSavePersona = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    let personaScores = {
      Minimalist: 0,
      Bohemian: 0,
      Classic: 0,
    };

    // Calculate persona scores based on answers and question weights
    questions.forEach((question) => {
      const answer = answers[question.id];
      if (answer) {
        personaScores.Minimalist += question.personaWeights?.Minimalist ?? 0;
        personaScores.Bohemian += question.personaWeights?.Bohemian ?? 0;
        personaScores.Classic += question.personaWeights?.Classic ?? 0;
      }
    });

    // Determine the most suitable persona (highest score)
    let bestPersona = Object.keys(personaScores).reduce((a, b) =>
      personaScores[a] > personaScores[b] ? a : b
    );

    // Get the persona id based on bestPersona name
    const { data: personas, error: personaError } = await supabase
      .from('personas')
      .select('id')
      .eq('persona_name', bestPersona);

    if (personaError) {
      console.error('Could not get best persona', personaError);
      return;
    }

    if (!personas || personas.length === 0) {
      console.error('No persona found');
      return;
    }

    const personaId = personas[0].id;

    // Save user persona to the database
    const { error: userPersonaError } = await supabase
      .from('user_personas')
      .insert([
        {
          user_id: user.id,
          persona_id: personaId,
          score: personaScores[bestPersona],
        },
      ]);

    if (userPersonaError) {
      console.error('Error saving user persona:', userPersonaError.message);
      return;
    }

    // Update user_profiles to mark onboarding_completed as true
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', user.id);

    if (profileUpdateError) {
      console.error('Error updating user profile:', profileUpdateError.message);
      return;
    }

    setCompleted(true);
  };

  if (loading) {
    return <p>Loading quiz...</p>;
  }

  if (completed) {
    return <p>Onboarding Completed!</p>;
  }

  return (
    <div>
      <h2>Onboarding Quiz</h2>
      {questions.map((question) => (
        <div key={question.id}>
          <p>{question.text}</p>
          {question.options.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answers[question.id] === option}
                onChange={() => handleAnswerChange(question.id, option)}
              />
              {option}
            </label>
          ))}
        </div>
      ))}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default OnboardingQuiz;