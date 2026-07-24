import {
  BREAKPOINTS,
  CONTENT_WIDTH,
  matchViewport,
  isDesktopViewport,
  isTabletOrUp,
  PAGE_TYPES,
} from './responsiveBreakpoints.js';

function assert( cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(BREAKPOINTS.tablet === 768, 'tablet bp');
assert(BREAKPOINTS.desktop === 1100, 'desktop bp');
assert(BREAKPOINTS.wide === 1440, 'wide bp');
assert(CONTENT_WIDTH.reading === 720, 'reading width');
assert(CONTENT_WIDTH.workspace === 1200, 'workspace width');
assert(PAGE_TYPES.conversational === 'A', 'page type A');

assert(matchViewport(390) === 'mobile', '390 mobile');
assert(matchViewport(767) === 'mobile', '767 mobile');
assert(matchViewport(768) === 'tablet', '768 tablet');
assert(matchViewport(1099) === 'tablet', '1099 tablet');
assert(matchViewport(1100) === 'desktop', '1100 desktop');
assert(matchViewport(1440) === 'wide', '1440 wide');

assert(!isDesktopViewport(800), '800 not desktop');
assert(isDesktopViewport(1200), '1200 desktop');
assert(isTabletOrUp(800), '800 tablet+');
assert(!isTabletOrUp(500), '500 not tablet+');

console.log('responsiveBreakpoints.test.js: ok');
