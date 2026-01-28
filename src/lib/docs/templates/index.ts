export { apiReferenceTemplate } from './api-reference';
export { userGuideTemplate } from './user-guide';
export { changelogTemplate } from './changelog';
export { tutorialTemplate } from './tutorial';
export { faqTemplate } from './faq';
export { readmeTemplate } from './readme';

export const allTemplates = [
  require('./api-reference').apiReferenceTemplate,
  require('./user-guide').userGuideTemplate,
  require('./changelog').changelogTemplate,
  require('./tutorial').tutorialTemplate,
  require('./faq').faqTemplate,
  require('./readme').readmeTemplate,
];
