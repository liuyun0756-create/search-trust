"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ShieldCheck, RotateCcw, ChevronRight } from 'lucide-react';
import { BackHeader } from '@/components/common/BackHeader';

const tabs = [
  { id: 'terms', label: 'Terms of Service', icon: FileText },
  { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { id: 'refunds', label: 'Refund Policy', icon: RotateCcw },
] as const;

type TabId = (typeof tabs)[number]['id'];

// Data structure remains same as provided in your source
const policyContent: Record<TabId, { title: string; effective: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: 'Terms of Service',
    effective: 'April 14, 2026',
    sections: [
      {
        heading: '1. Our service',
        body: `SearchTrust provides digital analysis and reporting services for submitted web pages or URLs. Our service is designed to evaluate a submitted page and provide a structured report, which may include observations, scoring, diagnostic output, findings, and recommended actions.

Each purchase covers the specific service described at checkout or on the pricing page. Unless otherwise stated, a one-time purchase covers one report for one submitted URL.

We may update, improve, modify, suspend, or discontinue parts of the service at any time.`,
      },
      {
        heading: '2. Eligibility',
        body: `You may use our website and services only if you are legally capable of entering into a binding agreement under applicable law.

If you are using the service on behalf of a company, agency, or other organization, you represent that you have authority to bind that entity to these Terms.`,
      },
      {
        heading: '3. Purchases and payment',
        body: `Prices are listed on our website or checkout pages. By placing an order, you agree to pay the listed price, together with any applicable taxes, fees, or charges disclosed at checkout.

Payments on this website are processed by Paddle. Paddle may act as merchant of record for transactions, and your payment may be subject to Paddle's terms, policies, and checkout processes.

Unless expressly stated otherwise: purchases are one-time payments, each purchase applies to the specific report or service selected, there is no recurring subscription or automatic renewal.

We reserve the right to change pricing at any time, but any pricing changes will not affect orders already completed.`,
      },
      {
        heading: '4. Submission and delivery',
        body: `To receive the service, you may be required to submit information such as a URL, email address, and any other details needed to process the report.

You are responsible for ensuring that submitted information is accurate and that you have the right to submit the page or material for analysis.

After purchase and required submission, your report will generally be delivered via email or web report within two hours. Delivery times are estimates only and may vary based on demand, technical issues, review requirements, or other operational factors.

We are not responsible for delays caused by incorrect information provided by you, unavailable websites, inaccessible pages, third-party failures, or events outside our reasonable control.`,
      },
      {
        heading: '5. Refunds',
        body: `Refunds are governed by our Refund Policy, available at trysearchtrust.com policy page.

In general, because our service is a digital product or analysis service, refunds are only available in limited circumstances, such as before processing begins or where required by law.`,
      },
      {
        heading: '6. Permitted use',
        body: `You may use our website and reports only for lawful purposes. You agree not to:

• use the service in violation of any law or regulation
• interfere with or disrupt the website or service
• attempt to gain unauthorized access to our systems
• copy, resell, or exploit the service except as permitted by us
• use bots, scraping tools, or automated methods to access restricted parts of the service without authorization
• reverse engineer, decompile, or attempt to extract the underlying systems, prompts, models, or methodologies except where prohibited by law`,
      },
      {
        heading: '7. Your content and submissions',
        body: `You may provide URLs, text, data, or other inputs in connection with the service ("Submissions").

You retain any rights you may have in your Submissions. By submitting content to us, you grant us a limited, non-exclusive right to use, process, store, and analyze those Submissions solely for the purpose of providing the service, supporting operations, improving quality, preventing abuse, and complying with legal obligations.

You represent that: you have the necessary rights to submit the content, your Submissions do not violate applicable law, your Submissions do not infringe the rights of any third party.`,
      },
      {
        heading: '8. Intellectual property',
        body: `The website, branding, content, design, software, report format, methodologies, and all related intellectual property associated with SearchTrust, excluding your own Submissions, are owned by or licensed to us.

These Terms do not transfer any ownership rights to you. You may not reproduce, distribute, modify, create derivative works from, publicly display, or commercially exploit our materials except as expressly permitted by us.`,
      },
      {
        heading: '9. No guarantees',
        body: `Our reports and outputs are provided for informational and internal business use only. We do not guarantee: search rankings, SEO performance, traffic growth, lead generation, conversion improvements, revenue impact, compliance outcomes, or any specific business result.

Any analysis, recommendations, scores, or findings provided through the service are opinions or automated outputs based on available inputs and methodologies at the time of analysis.

Our service does not constitute legal, financial, tax, compliance, or other professional advice.`,
      },
      {
        heading: '10. Service availability',
        body: `We aim to provide a reliable service, but we do not guarantee that the website or service will always be available, uninterrupted, secure, or error-free.

We may suspend access for maintenance, upgrades, abuse prevention, or operational reasons.`,
      },
      {
        heading: '11. Disclaimer of warranties',
        body: `To the maximum extent permitted by law, the website and services are provided on an "as is" and "as available" basis.

We disclaim all warranties, express or implied, including any implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, or reliability.`,
      },
      {
        heading: '12. Limitation of liability',
        body: `To the maximum extent permitted by law, SearchTrust and its affiliates, officers, owners, employees, contractors, and service providers will not be liable for any indirect, incidental, consequential, special, exemplary, or punitive damages, including loss of profits, revenue, data, business opportunities, or goodwill, arising out of or related to your use of the website or services.

To the maximum extent permitted by law, our total liability for any claim arising out of or relating to the service will not exceed the amount you paid us for the specific purchase giving rise to the claim.

Nothing in these Terms excludes liability that cannot be excluded under applicable law.`,
      },
      {
        heading: '13. Indemnification',
        body: `You agree to indemnify and hold harmless SearchTrust and its affiliates, officers, owners, employees, contractors, and service providers from and against any claims, liabilities, damages, losses, and expenses arising out of: your misuse of the service, your violation of these Terms, your Submissions, or your violation of any law or third-party rights.`,
      },
      {
        heading: '14. Termination or refusal of service',
        body: `We may suspend, restrict, cancel, or refuse service at any time if we reasonably believe that: you are violating these Terms, your use is unlawful or abusive, fraud or payment issues are involved, or the requested service cannot be completed safely or reasonably.

If we cancel an order before processing begins, we may issue a refund where appropriate.`,
      },
      {
        heading: '15. Third-party services',
        body: `Our website and services may rely on third-party providers, including payment processors, hosting providers, analytics services, communication tools, and AI infrastructure providers.

We are not responsible for the acts, omissions, or independent terms of third-party services.`,
      },
      {
        heading: '16. Changes to these Terms',
        body: `We may update these Terms from time to time. The updated version will be posted on this page with a revised effective date.

By continuing to use the website or services after updated Terms become effective, you agree to the revised Terms.`,
      },
      {
        heading: '17. Governing law',
        body: `These Terms are governed by the laws of USA, without regard to conflict of law principles.

Any dispute arising out of or relating to these Terms or the services will be subject to the courts located in USA, unless applicable law requires otherwise.`,
      },
      {
        heading: '18. Contact',
        body: `If you have questions about these Terms, please contact:

Company Name: SearchTrust
Email: liu6685756@gmail.com
Website: trysearchtrust.com`,
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    effective: 'April 14, 2026',
    sections: [
      {
        heading: '1. Information we collect',
        body: `We may collect the following categories of information:

a. Information you provide directly
When you use our website or purchase our services, you may provide information such as: your name, email address, billing address, company or organization name, submitted URLs or page information, messages you send to us, support requests, and any other information you choose to provide.

b. Payment information
Payments are processed by Paddle. We do not typically store your full payment card details. When you make a purchase, payment-related information may be collected and processed by Paddle in accordance with Paddle's own privacy practices and terms.

c. Automatically collected information
When you visit our website, we may automatically collect certain technical and usage information, such as: IP address, browser type, device type, operating system, referring pages, pages visited, dates and times of access, usage events, approximate location based on IP, and cookie or analytics identifiers.

d. Cookies and similar technologies
We may use cookies, pixels, analytics tools, and similar technologies to operate the website, understand usage, improve performance, and measure traffic.`,
      },
      {
        heading: '2. How we use information',
        body: `We may use your information to:

• provide and deliver reports and services
• process transactions and purchases
• communicate with you about your order
• provide customer support
• improve our website, products, and operations
• monitor usage and prevent abuse or fraud
• enforce our Terms and policies
• comply with legal obligations
• send important transactional or administrative messages

If we send marketing emails, we will do so in accordance with applicable law, and you may unsubscribe where applicable.`,
      },
      {
        heading: '3. Legal bases for processing',
        body: `If applicable data protection laws require a legal basis for processing personal information, we may process information on the basis of: performance of a contract, your consent, our legitimate interests in operating and improving the business, and compliance with legal obligations.`,
      },
      {
        heading: '4. How we share information',
        body: `We do not sell your personal information in the ordinary sense of selling customer lists for money.

We may share information with trusted third parties only as needed to operate the service, including: payment processors such as Paddle, hosting and infrastructure providers, analytics providers, customer support or communication tools, contractors or service providers assisting with operations, and legal or regulatory authorities when required by law.

We may also disclose information: to enforce our rights, to detect or prevent fraud, abuse, or security issues, in connection with a merger, acquisition, sale of assets, or business transfer.`,
      },
      {
        heading: '5. Payment processing by Paddle',
        body: `Payments on our website are processed by Paddle. When you complete a transaction, certain personal and transaction-related information may be collected and processed by Paddle as part of the checkout and payment process.

Please review Paddle's own privacy policy for more information about how Paddle handles payment and billing data.`,
      },
      {
        heading: '6. Data retention',
        body: `We retain personal information for as long as reasonably necessary to: provide the service, maintain records, resolve disputes, enforce agreements, comply with legal, tax, accounting, or regulatory obligations, and support legitimate business operations.

Retention periods may vary depending on the type of information and the purpose for which it was collected.`,
      },
      {
        heading: '7. Your rights and choices',
        body: `Depending on your location and applicable law, you may have rights relating to your personal information, including the right to:

• request access to your information
• request correction of inaccurate information
• request deletion of your information
• object to or restrict certain processing
• withdraw consent where processing is based on consent

To make a privacy-related request, contact us at liu6685756@gmail.com. We may need to verify your identity before responding.`,
      },
      {
        heading: '8. Cookies and analytics choices',
        body: `You may be able to control cookies through your browser settings. Disabling cookies may affect some website functionality.

If we use analytics or tracking tools, those providers may also offer their own opt-out mechanisms.`,
      },
      {
        heading: '9. International data transfers',
        body: `Your information may be processed and stored in countries other than your own, including where our hosting, analytics, payment, or operational service providers are located.

By using our website or services, you understand that your information may be transferred to and processed in jurisdictions with different data protection laws than those in your location.`,
      },
      {
        heading: '10. Data security',
        body: `We use reasonable administrative, technical, and organizational measures to help protect personal information. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.`,
      },
      {
        heading: '11. Children\'s privacy',
        body: `Our website and services are not directed to children, and we do not knowingly collect personal information from children under the age required by applicable law.

If you believe a child has provided us with personal information, please contact us and we will take appropriate steps.`,
      },
      {
        heading: '12. Third-party links',
        body: `Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review their privacy policies separately.`,
      },
      {
        heading: '13. Changes to this Privacy Policy',
        body: `We may update this Privacy Policy from time to time. The updated version will be posted on this page with a revised effective date.

Your continued use of the website or services after an update becomes effective indicates your acknowledgment of the updated policy.`,
      },
      {
        heading: '14. Contact',
        body: `If you have questions or requests regarding this Privacy Policy, please contact:

Company Name: SearchTrust
Email: liu6685756@gmail.com
Website: trysearchtrust.com`,
      },
    ],
  },

  refunds: {
    title: 'Refund Policy',
    effective: 'April 14, 2026',
    sections: [
      {
        heading: '1. Scope',
        body: `This policy applies to one-time purchases of digital reports, analyses, or related services sold through our website.`,
      },
      {
        heading: '2. General refund rule',
        body: `Because SearchTrust is a digital analysis and reporting service, refunds are generally available only in limited circumstances.

As a general rule:
• before processing begins: a refund request may be eligible for approval
• after processing has begun: the purchase is generally non-refundable
• after the report has been delivered: the purchase is non-refundable except where required by law`,
      },
      {
        heading: '3. What counts as processing',
        body: `For the purposes of this policy, processing begins once we start work on your order, which may include any of the following:

• your submitted URL or page enters our analysis workflow
• automated report generation begins
• manual review begins
• internal preparation or delivery steps specific to your order begin

Once processing has started, we typically cannot offer a refund because the digital service has already begun.`,
      },
      {
        heading: '4. Situations where a refund may be available',
        body: `We may approve a refund in situations such as:

• you contact us before processing begins
• you were charged more than once for the same order
• a duplicate order was placed by mistake
• we are unable to deliver the service due to a technical failure on our side
• or where a refund is otherwise required by applicable law`,
      },
      {
        heading: '5. Situations where a refund is generally not available',
        body: `Refunds are generally not available in the following situations:

• processing has already started
• the report has already been delivered
• you changed your mind after purchase
• you no longer need the report
• you submitted the wrong URL and processing has already started
• you are dissatisfied with the outcome, findings, score, or recommendations
• the analyzed page changed after submission or after delivery
• your expectations were based on results not promised by the service`,
      },
      {
        heading: '6. Incorrect submissions',
        body: `You are responsible for ensuring that the submitted URL and related information are correct at the time of submission.

If you submitted the wrong URL, contact us as soon as possible at liu6685756@gmail.com. If processing has not yet started, we may be able to assist or update the order. If processing has already started, the purchase is generally non-refundable.`,
      },
      {
        heading: '7. How to request a refund',
        body: `To request a refund, email us at liu6685756@gmail.com and include:

• the email address used for purchase
• the date of purchase
• the submitted URL, if applicable
• the reason for your request
• and any relevant supporting details`,
      },
      {
        heading: '8. Review process',
        body: `We review refund requests case by case and aim to respond within 3 business days.

If a refund is approved, it will generally be returned to the original payment method used for the purchase. Processing times for completed refunds may depend on Paddle, your payment provider, and your financial institution.`,
      },
      {
        heading: '9. Chargebacks and payment disputes',
        body: `If you have an issue with your order, please contact us first at liu6685756@gmail.com before initiating a chargeback or payment dispute.

We will do our best to resolve legitimate issues quickly and fairly.`,
      },
      {
        heading: '10. Changes to this policy',
        body: `We may update this Refund Policy from time to time. The updated version will be posted on this page with a revised effective date.`,
      },
      {
        heading: '11. Contact',
        body: `If you have any questions about this Refund Policy, contact:

Company Name: SearchTrust
Email: liu6685756@gmail.com
Website: trysearchtrust.com`,
      },
    ],
  },
};

export default function PolicyPage() {
  const [activeTab, setActiveTab] = useState<TabId>('terms');
  const current = policyContent[activeTab];

  return (
    <div className="bg-[#F8F9FA] min-h-screen font-sans text-[#1D2531] selection:bg-[#A5D020]/30">

      {/* 顶部导航栏 */}
      <BackHeader />

      {/* Main Content */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#3B82F6] mb-6 ml-2">
                Navigation
              </p>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full group flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 border ${
                      isActive 
                        ? 'bg-white border-[#F1F5F9] shadow-sm text-[#1D2531]' 
                        : 'border-transparent text-[#6B7280] hover:bg-gray-100 hover:text-[#1D2531]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg transition-colors ${
                        isActive ? 'bg-[#A5D020]/10 text-[#A5D020]' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                      }`}>
                        <tab.icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="text-[15px] font-bold">{tab.label}</span>
                    </div>
                    {isActive && (
                      <motion.div layoutId="active-nav-indicator">
                        <ChevronRight size={16} className="text-[#A5D020]" />
                      </motion.div>
                    )}
                  </button>
                );
              })}

              {/* Support Card */}
              <div className="mt-12 p-6 rounded-[24px] bg-[#0B0C0E] text-white relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#A5D020]/10 blur-2xl rounded-full translate-x-1/2 translate-y-1/2" />
                <h4 className="text-lg font-bold mb-2 relative z-10">Need help?</h4>
                <p className="text-sm text-gray-400 mb-6 relative z-10 leading-snug">Questions about our legal terms or a refund request?</p>
                <a 
                  href="mailto:liu6685756@gmail.com" 
                  className="inline-flex items-center text-[#A5D020] text-sm font-bold hover:underline gap-1 group"
                >
                  Contact Support 
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
          </aside>

          {/* Policy Body Content */}
          <main className="lg:col-span-8 xl:col-span-9 bg-white rounded-[32px] border border-[#F1F5F9] p-8 md:p-16 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-12 pb-8 border-b border-gray-100">
                  <h2 className="text-[32px] md:text-[40px] font-bold tracking-tight text-[#1D2531] mb-2 uppercase">
                    {current.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[14px] text-[#3B82F6] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    Effective {current.effective}
                  </div>
                </div>

                <div className="space-y-16">
                  {current.sections.map((section, idx) => (
                    <div key={idx} className="group">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="mt-1.5 w-5 h-1 bg-[#A5D020] rounded-full group-hover:w-8 transition-all duration-300" />
                        <h3 className="text-[20px] md:text-[24px] font-bold text-[#1D2531] tracking-tight">
                          {section.heading}
                        </h3>
                      </div>
                      <div className="text-[16px] text-[#4B5563] leading-[1.6] font-medium whitespace-pre-line pl-9">
                        {section.body}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Internal Page Links - Footer logic */}
                <div className="mt-20 pt-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                  <p className="text-[13px] text-gray-400 font-bold">
                    © 2026 SearchTrust. Technical SEO Analysis.
                  </p>
                  <div className="flex gap-6">
                    <button className="text-[13px] text-[#3B82F6] font-bold hover:underline underline-offset-4">Terms</button>
                    <button className="text-[13px] text-[#3B82F6] font-bold hover:underline underline-offset-4">Privacy</button>
                    <button className="text-[13px] text-[#3B82F6] font-bold hover:underline underline-offset-4">Refunds</button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </section>

      {/* 3. Global Footer Simple */}
      <footer className="py-12 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="w-10 h-10 bg-[#0B0C0E] rounded-xl mx-auto flex items-center justify-center mb-4">
                <span className="text-[#A5D020] font-black text-xl italic">S</span>
            </div>
            <p className="text-[14px] text-gray-400 font-medium">Restrained. Trustworthy. Technical.</p>
        </div>
      </footer>
    </div>
  );
}