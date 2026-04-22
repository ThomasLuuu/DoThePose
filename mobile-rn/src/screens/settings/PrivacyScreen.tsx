import React from 'react';
import { StaticInfoPage, InfoSection } from './components/StaticInfoPage';

const SECTIONS: InfoSection[] = [
  {
    heading: 'Overview',
    body: 'Pose Guide ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use our mobile application. We believe in minimal data collection and transparent processing.',
  },
  {
    heading: '1. Data We Collect',
    body: 'We collect only the minimum data necessary to provide the App\'s features:\n\n• Camera images: Photos you capture or select from your device\'s library for pose overlay generation.\n• Device diagnostics: Basic crash reports and performance data used solely to diagnose reliability issues (collected anonymously without personally identifiable information).\n\nWe do not collect your name, email address, phone number, location, or any other personal identifying information unless you voluntarily provide it when contacting support.',
  },
  {
    heading: '2. How We Use Your Data',
    body: 'Images you submit are used exclusively to generate pose guide overlays. Diagnostic data is used to identify crashes, fix bugs, and improve app stability. We do not sell, rent, share, or monetise your data in any form.',
  },
  {
    heading: '3. Image Processing',
    body: 'All pose detection processing is performed in a temporary processing pipeline. Your image is transmitted securely, analysed to detect human body pose points, and the overlay result is returned to your device.\n\nImportant commitments:\n• Your images are not stored on our servers after processing is complete.\n• Your images are never used to train, fine-tune, or improve any AI or machine learning model.\n• No image data is retained beyond the duration of a single processing request.',
  },
  {
    heading: '4. Storage and Retention',
    body: 'Pose results you choose to save are stored locally on your device only. We do not maintain copies of saved photos on any server. You can delete all locally saved photos at any time from the App\'s Settings screen under "Delete all gallery photos". Uninstalling the App will remove all locally stored app data.',
  },
  {
    heading: '5. Third-Party Services',
    body: 'The App does not currently integrate third-party advertising networks, social media SDKs, or external analytics platforms that collect personal data. Anonymous crash reporting may be routed through a stability monitoring service; such reports do not contain identifiable information or image content.',
  },
  {
    heading: '6. Your Rights',
    body: 'Because we do not retain personal data on our servers, there is generally no personal data for us to access, correct, or delete on your behalf. For data stored locally on your device, you have full control at all times through the App settings or device storage management tools.',
  },
  {
    heading: '7. Tracking and Cookies',
    body: 'The App does not use cookies. On mobile, the App does not track you across other apps or websites, does not use advertising identifiers, and does not participate in cross-app tracking programmes.',
  },
  {
    heading: '8. Children\'s Privacy',
    body: 'The App is not directed to children under the age of 13. We do not knowingly collect data from children. If you believe a child has submitted data through the App, please contact us and we will take prompt action.',
  },
  {
    heading: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last Updated" date. Continued use of the App after updates constitutes acceptance of the revised policy.',
  },
  {
    heading: '10. Contact Us',
    body: 'If you have questions, concerns, or requests regarding this Privacy Policy or your data, please reach out:\n\nsupport@poseguide.app\n\nWe aim to respond to all privacy enquiries within 7 business days.',
  },
];

export const PrivacyScreen: React.FC = () => (
  <StaticInfoPage
    sections={SECTIONS}
    footer="Last updated: April 2026"
  />
);
