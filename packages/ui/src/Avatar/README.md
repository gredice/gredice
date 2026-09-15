# Farmer avatar artwork

The two built-in farmer choices use transparent 3D portraits derived from
`GameIcons/assets/profile.webp`. The square images include padding to keep the
hat and shoulders inside the circular avatar crop.

`farmerAvatarUrls` contains the stable CDN URLs already saved in user profiles.
`resolveAvatarSource` maps only those two exact URLs to bundled artwork at
render time. Both `Avatar` and `UserAvatar` use it, so existing selections and
new selections show the updated portraits in Garden, WWW, Admin and Farm.
Custom URLs, initials, profile links and achievement levels keep their existing
behavior. Do not save build-specific static asset URLs in user profiles.

Artwork and generation prompts live in `assets/`. Review
`packages/ui/Data Display/UserAvatar` (Farmers and Farmers Dark) and the Garden
workspace showcase for circular crops, compact sizes, level badges and the picker.
