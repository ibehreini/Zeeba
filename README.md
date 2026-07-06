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
take a photo and upload, then real data
;after database] For closet item details - ability delete item, replace image, edit name/description
[after database] For closet, add items
[after database] Create a new outfit and save it with attributes, also "try it on" to submit pics of you trying it on to make sure it looks right
next: new outfit includes tags for type of fit it is like 'work' or 'garden party'
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
   database schema so far
### 1. `users`

Tracks everyone authenticating via Google Auth.

* **`id`** (Primary Key, INT Auto-Increment or UUID)
* **`google_id`** (VARCHAR, Unique)
* **`email`** (VARCHAR)
* **`username`** (VARCHAR)
* **`created_at`** (TIMESTAMP)

### 2. `closets`

The container for a wardrobe.

* **`id`** (Primary Key, INT Auto-Increment or UUID)
* **`owner_id`** (Foreign Key linking to `users.id`)
* **`closet_name`** (VARCHAR)
* **`pass_phrase`** (VARCHAR, Unique)

### 3. `closet_collaborators`

The join table registering which users act as a **Stylist** for a friend's closet.

* **`id`** (Primary Key)
* **`user_id`** (Foreign Key linking to `users.id`)
* **`closet_id`** (Foreign Key linking to `closets.id`)
* *Constraint: Unique pair (`user_id`, `closet_id`)*

### 4. `clothing_items`

Individual garments inside a specific closet.

* **`id`** (Primary Key, INT Auto-Increment or UUID)
* **`closet_id`** (Foreign Key linking to `closets.id`)
* **`item_type`** (ENUM / VARCHAR) — *Strictly: `'shirt'`, `'pants'`, `'accessory'`, `'dress_romper'`, `'shoes'`_
* **`name`** (VARCHAR)
* **`description`** (TEXT)

### 5. `clothing_item_photos`

Allows unlimited photos per individual clothing item (flat lay, tried on, etc.).

* **`id`** (Primary Key)
* **`clothing_item_id`** (Foreign Key linking to `clothing_items.id` ON DELETE CASCADE)
* **`image_url`** (TEXT)
* **`is_primary`** (BOOLEAN, Default: false)

### 6. `outfits`

The styled combinations.

* **`id`** (Primary Key, INT Auto-Increment or UUID)
* **`closet_id`** (Foreign Key linking to `closets.id`)
* **`created_by_user_id`** (Foreign Key linking to `users.id`)
* **`name`** (VARCHAR)
* **`description`** (TEXT)
* **`labels`** (TEXT)
* **`compliment_count`** (INT, Default: 0)

### 7. `outfit_photos` (Kept & Streamlined 🔄)

Allows users to upload photos of the outfit being worn out in the world. *Simplified to remove user-tracking.*

* **`id`** (Primary Key)
* **`outfit_id`** (Foreign Key linking to `outfits.id` ON DELETE CASCADE)
* **`image_url`** (TEXT) — *The link to the uploaded fit pic*
* **`created_at`** (TIMESTAMP)

### 8. `outfit_items`

Connects clothes to outfits.

* **`outfit_id`** (Foreign Key linking to `outfits.id` ON DELETE CASCADE)
* **`clothing_item_id`** (Foreign Key linking to `clothing_items.id` ON DELETE CASCADE)
* *Primary Key: Composite key of (`outfit_id`, `clothing_item_id`)*

### 9. `wear_logs`

Tracks historical usage of outfits or single items for metrics.

* **`id`** (Primary Key)
* **`user_id`** (Foreign Key linking to `users.id`)
* **`closet_id`** (Foreign Key linking to `closets.id`)
* **`outfit_id`** (Foreign Key linking to `outfits.id`, Nullable)
* **`clothing_item_id`** (Foreign Key linking to `clothing_items.id`, Nullable)
* **`worn_on_date`** (DATE, Default: Current Date)

