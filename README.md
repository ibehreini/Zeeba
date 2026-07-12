# Welcome to your Expo app 👋
I left off on: 
for stylist, should list all the closets they are collaboraters on. Also select the one they want - and see it, banner different color bc they are stylist.

passphrase i dont think is enough to be stylist ? email and passphrase?
edit flow for item and outfit
maybe event log who made what outfit or edited last


refactor code


when the user saves it sends the add request to the db and either 
in the details page they should be able to see an 'edit' button at top right so they can edit the details and click save. the save will update the db row and either say success or error

To to: 
make new tags? who can make? admin only?

then its always there
auth, profile info
when you click i wore this today - drum iranian sound easter egg
next: can request a fit - suggest peices you want to wera?
next: closet code to access your particular closet
next: items detail view should also have a section "your item in the wild" with ability to upload pics of you weraing that item so people know how it looks on the body
next: count for how many times you wore an item
next: profile or closet details like 'style' 'goals' 'colors you love' 'inspo'
next: user accounts? authentication?
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
compress images and limit file size in the bucket too and file type
the clothing items themselves get their wear count from the downstream outfits linked to that clothing item. so what happens if you delete or edit an outfit? maybe a case for not editing an outfit like the items themselves but just making a new one