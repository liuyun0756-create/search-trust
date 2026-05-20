"use client";

import React from 'react';

const teams = [
  { name: 'SEO Agencies', image: '/images/user1.png' },
  { name: 'Local SEO Teams', image: '/images/user2.png' },
  { name: 'Affiliate Operators', image: '/images/user3.png' },
  { name: 'Multi-Location Businesses', image: '/images/user4.png' },
];

export function TrustedByTeams() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {teams.map((team, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-[#1A1F2B]">{team.name}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
