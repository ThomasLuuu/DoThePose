import React from 'react';
import { StaticInfoPage, InfoSection } from './components/StaticInfoPage';

const SECTIONS: InfoSection[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By downloading, installing, or using Pose Guide ("the App"), you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use the App. We reserve the right to update these terms at any time; continued use of the App after changes constitutes your acceptance of the revised terms.',
  },
  {
    heading: '2. Use of the App',
    body: 'Pose Guide is provided for personal, non-commercial use. You may use the App to generate pose guide overlays from images you own or have the right to use. You must be at least 13 years of age to use the App. You are solely responsible for all content you upload or process through the App.',
  },
  {
    heading: '3. User Content and Intellectual Property',
    body: 'You retain full ownership of all images you upload or capture within the App. By using the App, you grant Pose Guide a limited, temporary, non-exclusive licence to process your images solely for the purpose of generating pose overlays. This licence ends immediately upon completion of processing. We do not store, redistribute, or claim any rights over your content beyond what is necessary to provide the service.',
  },
  {
    heading: '4. Prohibited Uses',
    body: 'You may not use the App to upload, process, or generate content that:\n\n• Is illegal, harmful, threatening, abusive, or harassing.\n• Depicts minors in any inappropriate or sexual manner.\n• Infringes upon the intellectual property, privacy, or other rights of any third party.\n• Contains malware, viruses, or any code intended to disrupt or harm systems.\n• Violates any applicable local, national, or international law or regulation.\n\nViolation of these prohibitions may result in immediate termination of your access to the App.',
  },
  {
    heading: '5. AI Processing Disclosure',
    body: 'The App uses automated image analysis to detect human poses and generate overlay guides. This processing is performed temporarily and solely to provide the requested feature. Your images are not used to train, fine-tune, or otherwise improve any AI or machine learning model. Processed image data is discarded after the pose overlay is generated unless you explicitly choose to save the result locally to your device.',
  },
  {
    heading: '6. Limitation of Liability',
    body: 'To the fullest extent permitted by applicable law, Pose Guide and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the App. The App is provided "as is" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.',
  },
  {
    heading: '7. Termination',
    body: 'We reserve the right to suspend or terminate your access to the App at any time, without notice, for conduct that we believe violates these Terms or is otherwise harmful to other users, us, or third parties. Upon termination, all locally saved content on your device remains yours; we make no claim over it.',
  },
  {
    heading: '8. Changes to These Terms',
    body: 'We may revise these Terms & Conditions from time to time. We will notify users of material changes by updating the "Last Updated" date below. Your continued use of the App after any change constitutes acceptance of the new terms.',
  },
  {
    heading: '9. Governing Law',
    body: 'These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in the applicable territory.',
  },
  {
    heading: '10. Contact',
    body: 'If you have questions about these Terms & Conditions, please contact us at:\n\nsupport@poseguide.app',
  },
];

export const TermsScreen: React.FC = () => (
  <StaticInfoPage
    sections={SECTIONS}
    footer="Last updated: April 2026"
  />
);
