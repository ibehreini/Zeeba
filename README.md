# Welcome to your Expo app 👋
I left off on:

left off on finishing db setup
npx expo start will start server and run on phone

then work on the crud functions - with outfit items save new outfit, delete outfit, edit outfit
lastly do the image upload from camera roll


To to: 
make new tags? who can make? admin only?
clothing item can have fit - boxy, hitsz above knees, etc
clothing item can have care instructions ex - dry clean only add once then its always there
auth, profile info
when you click i wore this today - drum iranian sound easter egg
CRUD for db in clothing and outfits

next: can request a fit - suggest peices you want to wera?
next: closet code to access your particular closet
next: items detail view should also have a section "your item in the wild" with ability to upload pics of you weraing that item so people know how it looks on the body
Next: Upload an item flow [with user handling the good uploading]
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