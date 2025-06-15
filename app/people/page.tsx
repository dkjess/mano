"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Person } from '@/types/database';

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchPeople();
  }, []);

  const checkUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people');
      const data = await response.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const filteredPeople = people.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (person.role && person.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '👥';
      case 'manager': return '👆';
      case 'stakeholder': return '🤝';
      case 'peer': return '👋';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      default: return relationshipType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 font-sf">
        <div className="text-center">
          <div className="text-2xl mb-2">🤚</div>
          <div className="text-gray-600 font-medium-bold">Loading your people...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 font-sf">
      {/* Header with user info and logout */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-medium-bold text-gray-900 flex items-center gap-2">
            👋 Your People
          </h1>
          <p className="text-gray-600 mt-2">Manage relationships with your team and stakeholders</p>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              {user.user_metadata?.avatar_url && (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user.user_metadata?.full_name || user.email}
                </div>
                {user.user_metadata?.full_name && (
                  <div className="text-xs text-gray-500">{user.email}</div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="font-medium-bold"
              >
                👋 Sign Out
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add Person Button */}
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button asChild className="font-medium-bold">
          <Link href="/people/new">🤲 Add Person</Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Input
            type="text"
            placeholder="🔍 Search people..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="font-sf"
          />
        </div>
      </div>

      {/* People List */}
      {filteredPeople.length === 0 && !searchTerm ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🤲</div>
          <h3 className="text-lg font-medium-bold text-gray-900 mb-2">
            {searchTerm ? 'No people found' : 'No people yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Add your first team member or stakeholder to get started'}
          </p>
          {!searchTerm && (
            <Button asChild>
              <Link href="/people/new">🤲 Add Your First Person</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 1-1 Management Assistant - Always show at top when not searching */}
          {!searchTerm && (
            <>
              <Link href="/people/1-1" className="block">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 shadow-sm border-2 border-blue-200 hover:shadow-md hover:border-blue-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">
                        🧠
                      </div>
                      <div>
                        <div className="font-medium-bold text-gray-900">
                          1-1
                        </div>
                        <div className="text-sm text-gray-600">
                          One-on-one management coaching and strategic advice
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-600 mb-1">
                        Management Assistant
                      </div>
                      <div className="text-xs text-gray-400">
                        Always available
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              
              {/* Separator line */}
              {filteredPeople.length > 0 && (
                <div className="flex items-center py-2">
                  <div className="flex-1 border-t border-gray-200"></div>
                  <div className="px-4 text-xs text-gray-500 font-medium">Your Team</div>
                  <div className="flex-1 border-t border-gray-200"></div>
                </div>
              )}
            </>
          )}
          
          {/* Show message when no people but has search term */}
          {filteredPeople.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium-bold text-gray-900 mb-2">
                No people found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search terms
              </p>
            </div>
          )}
          
          {/* Regular people list */}
          {filteredPeople.map((person) => (
            <Link 
              key={person.id} 
              href={`/people/${person.id}`}
              className="block"
            >
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getRelationshipEmoji(person.relationship_type)}
                    </div>
                    <div>
                      <div className="font-medium-bold text-gray-900">
                        {person.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {person.role || 'No role specified'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">
                      {getRelationshipLabel(person.relationship_type)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Added {new Date(person.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}