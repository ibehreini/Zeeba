# Welcome to your Expo app 👋
I left off on:

database setup
https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-nativee

upload a few items from phone and make dummy data but with real iphone pics Ithink will be good
then I want to clean up code - helper functions - enforce one outfit grid type
https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
also add ability to add multiple sub pyhotos for the clothing item and outfit? worn in the wild? to look at fit and different cuts and fabrics and tones
eventually will use the react view shot libary here https://docs.expo.dev/versions/latest/sdk/captureRef/
To to: 
This dummy data - I may want to have a 'preview mode' for users to try out the generic closet before logging in. so keep the dummy data somewehre.
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
