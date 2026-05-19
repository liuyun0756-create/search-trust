"use client";

import React from 'react';
import { MapPin, Building2, Layers, Users } from 'lucide-react';

const userTypes = [
  {
    title: 'Local SEO teams',
    desc: 'Reviewing important local pages before publishing or revising them.',
    icon: MapPin,
  },
  {
    title: 'Agencies',
    desc: 'Explaining page–level trust weaknesses to clients more clearly.',
    icon: Building2,
  },
  {
    title: 'Scale Operators',
    desc: 'Checking AI-assisted, templated, or programmatic pages.',
    icon: Layers,
  },
  {
    title: 'Multi-location',
    desc: 'Validating whether local pages are grounded enough to compete.',
    icon: Users,
  },
];

export function WhoThisIsFor() {
  return (
    <section className="pt-20 bg-white rounded-t-[80px]">
      <div className="max-w-[1300px] mx-auto px-8">
        <h2 className="text-[48px] font-bold text-center mb-24">Who this is for</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {userTypes.map((user, i) => (
            <div
              key={i}
              className="bg-[#F8F9FB] rounded-[40px] p-10 flex flex-col gap-8 border border-transparent hover:border-[#EBECEF] transition-all group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-[#A5D020] group-hover:text-white transition-colors">
                <user.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[20px] font-bold mb-4">{user.title}</h4>
                <p className="text-[15px] text-[#3E4651] opacity-60 leading-relaxed">{user.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
