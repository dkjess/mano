"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type { Person } from '@/types/database';

interface PeopleState {
  people: Person[];
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;
}

interface PeopleContextType extends PeopleState {
  fetchPeople: (force?: boolean) => Promise<void>;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  getPerson: (id: string) => Person | null;
}

type PeopleAction =
  | { type: 'SET_PEOPLE'; payload: Person[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_PERSON'; payload: Person }
  | { type: 'UPDATE_PERSON'; payload: Person }
  | { type: 'DELETE_PERSON'; payload: string };

const PeopleContext = createContext<PeopleContextType | undefined>(undefined);

const peopleReducer = (state: PeopleState, action: PeopleAction): PeopleState => {
  switch (action.type) {
    case 'SET_PEOPLE':
      return {
        ...state,
        people: action.payload,
        isLoading: false,
        lastFetched: Date.now(),
        error: null
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'ADD_PERSON':
      return {
        ...state,
        people: [...state.people, action.payload]
      };
    case 'UPDATE_PERSON':
      return {
        ...state,
        people: state.people.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      };
    case 'DELETE_PERSON':
      return {
        ...state,
        people: state.people.filter(p => p.id !== action.payload)
      };
    default:
      return state;
  }
};

const initialState: PeopleState = {
  people: [],
  isLoading: false,
  lastFetched: null,
  error: null
};

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export function PeopleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(peopleReducer, initialState);
  const loadingRef = useRef(false);

  const fetchPeople = useCallback(async (force = false) => {
    console.log('🔍 fetchPeople called, force:', force, 'isLoading:', loadingRef.current);
    
    // Check cache with current state
    const now = Date.now();
    if (!force && state.lastFetched && (now - state.lastFetched) < CACHE_DURATION) {
      console.log('📦 Using cached data, skipping fetch');
      return;
    }

    // Use ref to prevent duplicate requests
    if (loadingRef.current) {
      console.log('⚠️ Already loading, skipping fetch');
      return;
    }
    
    loadingRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      console.log('🚀 Starting people fetch...');
      const response = await fetch('/api/people');
      if (!response.ok) {
        throw new Error(`Failed to fetch people: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ People fetched successfully:', data.people?.length || 0);
      dispatch({ type: 'SET_PEOPLE', payload: data.people || [] });
    } catch (error) {
      console.error('❌ Failed to fetch people:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to fetch people' });
    } finally {
      loadingRef.current = false;
    }
  }, []); // FIXED: Empty dependencies array prevents infinite loop

  // Fetch on mount only
  useEffect(() => {
    console.log('🔍 PeopleProvider mounted, fetching people...');
    fetchPeople();
  }, [fetchPeople]);

  const addPerson = useCallback((person: Person) => {
    dispatch({ type: 'ADD_PERSON', payload: person });
  }, []);

  const updatePerson = useCallback((person: Person) => {
    dispatch({ type: 'UPDATE_PERSON', payload: person });
  }, []);

  const deletePerson = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PERSON', payload: id });
  }, []);

  const getPerson = useCallback((id: string): Person | null => {
    return state.people.find(p => p.id === id) || null;
  }, [state.people]);

  const contextValue: PeopleContextType = {
    ...state,
    fetchPeople,
    addPerson,
    updatePerson,
    deletePerson,
    getPerson,
  };

  return (
    <PeopleContext.Provider value={contextValue}>
      {children}
    </PeopleContext.Provider>
  );
}

export const usePeople = () => {
  const context = useContext(PeopleContext);
  if (!context) {
    throw new Error('usePeople must be used within PeopleProvider');
  }
  return context;
};