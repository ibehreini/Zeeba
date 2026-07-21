# Welcome to your Expo app 👋
To Do - app
limit on closet description and name and care instructions
local policy on db and production one on creating new user row on sign in - ensure trigger isnt duplicate
fix policies on buckets for global read / write - error messages on cannot upload - silently falls baqck to uploading uncompressed images which we dont want
compliment count is on outfit already in db, show it and add the button for it

refactor code



To to: 
make new tags? who can make? admin only?

then its always there
auth, profile info
when you click i wore this today - drum iranian sound easter egg
next: can request a fit - suggest peices you want to wera?
idea: NFC tag integration. scan a tag and open the app with that item
idea: accessory packs for outfit variation - ex if wearing pink vs white purse what shoes to change
idea: audio recording so stylists can add an audio recording instead of typing why outfit works
next: profile or closet details like 'style' 'goals' 'colors you love' 'inspo'
next: ability to upload items from stores online shopping?
audio files for descriptions - the stylist can add
if you delete a clothing item, what happens to the outfit?
next: implement AI for image refinement?
Next: eventually if it is going to be like be my eyes, can let the helper know when someone complimented the fit, give feedback second 
draft outfit
ability to see circle of friends who are helping you pick outfits? visit closets?
ability to request to borrow friend's outfit or item from closet? comment? save? favorite?

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```
   under src/types you can find the supabase schema thats up to dat
   
   npx expo start --dev --cliente
   for expo to build on iphone again
   eas login
      eas build --platform ios --profile development                                                                    



Flow for collaborator
MVP
1 - login
2 - enter closet key or url for ida's closet
3 - view her clothing details and outfits
4- I want to make Ida a new outfit so I go into outfits and click 'create new'
5 - I select the clothing items and edit as needed then save
6 - it saves successfully



2.0
1. I am stylist and log in
2 - 

Tech debt:
google react pacakge I am using will eventaully be phased out. Replace with open source free package expo recomments
rls on supabase for all tables but especially on storage bucket its currently public to view and edit all of it. so eventually change that  - for outfit and clothing bucketsto authenticated users
my closet has an extra heading at the bottom of the page on item details view and in general closets page
closet seems to refresh when you open item details page then go back to the main closet page - scrolls all the way to the top which is annoying - but since there are heading smaybe not huge right now