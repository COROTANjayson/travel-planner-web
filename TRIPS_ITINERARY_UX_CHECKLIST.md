# Trips and itinerary UX checklist

Work from high to medium priority. Feature checks mark implementation; the separate verification checks cover automated and visual review.

## High priority

- [x] Make trip cards easy to scan: readable dates, trip status, and clear destination.
- [x] Put active and upcoming trips before past trips across pagination; add status filters.
- [x] Simplify trip creation: enter dates before optional exact times. The API accepts inclusive dates with null or omitted exact times, and protects existing activities when trip dates change.
- [x] Explain and confirm when changing a destination would clear entered dates and times.
- [x] Show the selected itinerary day and its position in the trip; add a Today shortcut during an active trip.
- [x] Keep day columns and activity cards visible on the board. Select a day for the shared Map and Conflicts controls; swipe between snapping columns on phones.
- [x] Make schedule conflicts actionable with a jump to the affected day and an edit action.
- [x] Protect unsaved activity edits when a dialog is dismissed.

## Medium priority

- [x] Make activity cards easier to scan; collapse notes and make the delete action less prominent.
- [x] Keep optional place selection visible while notes remain expandable.
- [x] Make the map follow the selected day and connect its pins to activity names.
- [x] Replace technical destination-search errors with plain-language recovery steps and provide trip/activity save feedback.

## Verification

- [x] Run lint, TypeScript, and `node scripts/check-itinerary.mjs`.
- [ ] Complete the production build: currently blocked by network access to Google Fonts (Geist and Geist Mono).
- [x] Run API tests against the configured test database, `go vet ./...`, and `go build ./cmd/api` for optional trip times.
- [x] Check trip creation, trip list, invitation acceptance, itinerary navigation, activity editing, People, Account, calendar and confirmation layouts in an isolated browser preview with sample data.
- [x] Verify widths 320, 375, 390, 430, 768, 1024 and 1440px, plus phone landscape, without page-level horizontal overflow.
- [x] Verify swipe selection, navigation across three-day windows, one-day trips, viewer permissions, empty/error states and signed-out navigation.
- [x] Check full-screen editors, bottom sheets, compact viewport scrolling and reduced-motion behavior.
- [x] Verify keyboard focus trapping, Escape dismissal, editor focus restoration and retaining values after a failed save.
- [ ] Verify physical-device keyboard and safe-area behavior on iOS and Android; browser checks use viewport emulation rather than device keyboards.

## Mobile app layout

- [x] Compact 56px mobile top bar, trip Back/title/options, and bottom Trips/Invitations/Account navigation below 768px.
- [x] Compact trip summary with expandable full details and a sticky itinerary toolbar.
- [x] Selected-day Add activity action above bottom navigation; per-day additions on desktop.
- [x] Activity overflow actions, full-screen forms/tools, and sheets for short interactions.
- [x] 48px mobile form controls, 16px input text, full-width primary actions, and safe-area spacing.
