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
    title: 'Operators reviewing scaled pages',
    desc: 'Checking AI-assisted, templated, or programmatic local pages before rollout',
    icon: Layers,
  },
  {
    title: 'Multi-location teams',
    desc: 'Validating whether local pages are grounded enough to compete independently.',
    icon: Users,
  },
];

export function WhoThisIsFor() {
  return (
    <section className="pt-20 bg-white rounded-t-[80px]">
      <div className="max-w-7xl mx-auto px-8">
        <h2 className="text-[48px] font-bold text-center mb-16">Who this is for</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {userTypes.map((user, i) => (
            <div
              key={i}
              className="group relative min-h-[280px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-[#A5D020]/40 hover:shadow-[0_18px_44px_rgba(15,23,42,0.07)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#A5D020]" />

              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F7E9] text-[#86B800] ring-1 ring-[#A5D020]/15 transition-colors duration-300 group-hover:bg-[#EEF6D4]">
                <user.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="mb-4 text-[20px] font-bold leading-snug text-[#1A212B]">{user.title}</h4>
                <p className="text-[15px] font-medium leading-relaxed text-[#4B5563]">{user.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
