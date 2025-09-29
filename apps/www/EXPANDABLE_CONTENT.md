# Expandable Plant Information Sections

This feature allows plant information sections to be collapsed/expanded when the content is too long, improving the user experience and readability of plant detail pages.

## How it works

### Automatic Length Detection
- Content longer than 500 characters is automatically made expandable
- A fade gradient appears at the bottom of collapsed content
- "Prikaži više" (Show more) / "Prikaži manje" (Show less) button toggles expansion

### Explicit Content Splitting
You can use the `<!-- more -->` delimiter in your content to explicitly mark where the content should be split:

```markdown
Main content that is always visible...

<!-- more -->

Additional content that is initially hidden and can be expanded.
```

## Implementation Details

### Components Added
1. **ExpandableText** (`/components/shared/ExpandableText.tsx`)
   - Main component that handles the expand/collapse functionality
   - Features fade gradient, smooth animations, and toggle button

2. **Content utilities** (`/lib/content/expandableContent.ts`)
   - `splitContentForExpansion()` - Splits content by delimiter
   - `shouldMakeExpandable()` - Determines if content should be expandable

### Modified Components
- **InformationSection** (`/app/biljke/[alias]/InformationSection.tsx`)
  - Updated to use ExpandableText for both main content and sort-specific content
  - Automatically detects long content and makes it expandable

## Usage Examples

### In Plant Information
When editing plant information in the CMS, you can add `<!-- more -->` to create expandable sections:

```markdown
**Osnovno o sijanju:**
Rajčicu sijte u zatvorenom prostoru 6-8 tjedana prije poslednjeg mraza.

<!-- more -->

**Detaljne upute za sijanje:**
- Koristite kvalitetnu zemlju za presadnice
- Održavajte temperaturu oko 21°C
- Sjeme posijte na dubinu 0.5 cm
- Klija za 5-10 dana

**Dodatni savjeti:**
- Zemlju držite vlažnom ali ne mokrom
- Koristite dobru drenažu
- Osigurajte dovoljno svjetla
```

### Result
The first part (up to `<!-- more -->`) will be visible immediately, while the detailed instructions will be hidden behind an expand button, keeping the page clean and readable.

## Demo Page
Visit `/demo-expandable` to see the functionality in action with sample content.

## Benefits
- **Better UX**: Long content doesn't overwhelm users
- **SEO-friendly**: All content remains in HTML for search engines
- **Responsive**: Works well on mobile devices
- **Accessible**: Proper button labels and smooth animations
- **Flexible**: Works with both automatic detection and manual control