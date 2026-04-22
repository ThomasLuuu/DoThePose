import React from 'react';
import { StaticInfoPage, InfoSection } from './components/StaticInfoPage';

const SECTIONS: InfoSection[] = [
  {
    heading: 'Getting Started',
    body: 'Pose Guide helps you capture better photos by overlaying a pose skeleton guide on your camera viewfinder. Here\'s the basic workflow:\n\n1. Open the App and complete onboarding (or replay it from Settings).\n2. On the Home screen, tap the camera button to enter Camera Overlay mode.\n3. In Camera Overlay mode, hold your device so the subject is visible in the frame.\n4. The pose overlay will appear automatically — adjust your position to match the guide.\n5. Tap the shutter to capture your photo.\n6. Review your session in the Session Review screen and save photos you want to keep to your Gallery.',
  },
  {
    heading: 'Frequently Asked Questions',
    body: 'Q: How do I upload my own reference image?\nA: From the Home screen, tap the "+" button or navigate to Guides. You can then import a photo from your device library to create a custom pose guide.\n\nQ: The pose overlay doesn\'t match my body position — what should I do?\nA: Make sure you are well-lit and fully visible in the frame. Stand a little further back so your full body is captured. If the overlay is still inaccurate, try re-entering Camera Overlay mode; detection re-initialises on each session.\n\nQ: Can I use my own images from the camera roll?\nA: Yes. Anywhere the App prompts you to pick an image, you can choose from your device\'s photo library.\n\nQ: My exported photo looks blurry. How do I fix this?\nA: Blurriness is typically caused by movement during capture or low ambient light. Use the timer feature to reduce camera shake, or shoot in a brighter environment.\n\nQ: Does the overlay work for group poses?\nA: The current version is optimised for single-person poses. Group detection is on our roadmap.',
  },
  {
    heading: 'Camera Permissions',
    body: 'Pose Guide requires camera access to display the live viewfinder and capture photos. If you denied permission during onboarding:\n\n1. Open your device Settings app.\n2. Scroll to Pose Guide in the app list.\n3. Tap Permissions and enable Camera.\n4. Return to the App — camera access will work immediately without restarting.\n\nThe App also requires Photo Library access to save captured photos to your gallery and to import reference images.',
  },
  {
    heading: 'Troubleshooting',
    body: 'Camera shows a black screen:\n• Ensure camera permission is granted (see Camera Permissions above).\n• Force-close the App and reopen it.\n• Restart your device if the issue persists.\n\nApp crashes on launch:\n• Update to the latest version from the App Store.\n• If the issue continues, try uninstalling and reinstalling the App. Your saved gallery photos will be removed — export them first if needed.\n\nPose detection is slow or not loading:\n• Check your internet connection. Pose detection requires an active network connection.\n• If your connection is good but detection still hangs, exit the camera screen and re-enter.\n\nGallery photos are missing:\n• If you cleared gallery storage from Settings, photos are permanently removed.\n• If you did not clear storage, check that Photo Library permission is granted.',
  },
  {
    heading: 'Managing Your Data',
    body: 'You can manage locally stored app data directly from the Settings screen:\n\n• Clear recent strip — removes the recent photo strip shown on the Home screen. Your saved gallery photos are not affected.\n• Delete all gallery photos — permanently removes all photos saved within the App from your device. This action cannot be undone.\n• Replay onboarding — launches the intro tutorial again from the beginning.\n\nThese actions only affect data stored by the App on your device. No server-side data is deleted because we do not retain your personal data or images on our servers.',
  },
  {
    heading: 'Contact Support',
    body: 'If you\'re experiencing an issue not covered above, our support team is happy to help.\n\nEmail: support@poseguide.app\n\nWhen writing in, please include:\n• A brief description of the problem.\n• Your device model and operating system version.\n• App version (visible at the bottom of the Settings screen).\n• Steps to reproduce the issue, if possible.\n\nWe aim to respond within 2 business days.',
  },
  {
    heading: 'Report a Bug',
    body: 'Found a bug or unexpected behaviour? Please report it to:\n\nsupport@poseguide.app\n\nUse the subject line "Bug Report" and describe what you expected to happen versus what actually happened. Screenshots or screen recordings are extremely helpful.',
  },
  {
    heading: 'Request a Feature',
    body: 'Have an idea for something that would make Pose Guide better? We\'d love to hear it.\n\nEmail: support@poseguide.app\nSubject line: "Feature Request"\n\nWe read every request and use your feedback to shape our roadmap. While we can\'t reply to every suggestion, the most popular and feasible requests are regularly incorporated into future updates.',
  },
];

export const HelpScreen: React.FC = () => (
  <StaticInfoPage sections={SECTIONS} />
);
