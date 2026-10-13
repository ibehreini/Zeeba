-- Adds 'sweater' and 'cardigan' as clothing_items.item_type values so knitwear
-- gets its own closet sections / filter pills instead of being lumped under
-- 'shirt'. Mirrored in src/services/dataService.types.ts (ClothingItemType).
ALTER TABLE "public"."clothing_items"
    DROP CONSTRAINT "clothing_items_item_type_check",
    ADD CONSTRAINT "clothing_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['shirt'::"text", 'sweater'::"text", 'cardigan'::"text", 'pants'::"text", 'dress_romper'::"text", 'shoes'::"text", 'jacket'::"text", 'purse'::"text", 'jewelry'::"text", 'accessory'::"text"])));
