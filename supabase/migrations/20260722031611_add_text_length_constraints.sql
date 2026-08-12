ALTER TABLE "public"."clothing_items"
    ADD CONSTRAINT "clothing_items_name_length" CHECK ("char_length"("name") <= 100),
    ADD CONSTRAINT "clothing_items_brand_length" CHECK ("char_length"("brand") <= 100),
    ADD CONSTRAINT "clothing_items_description_length" CHECK ("char_length"("description") <= 1000),
    ADD CONSTRAINT "clothing_items_fit_notes_length" CHECK ("char_length"("fit_notes") <= 500),
    ADD CONSTRAINT "clothing_items_care_instructions_length" CHECK ("char_length"("care_instructions") <= 500),
    ADD CONSTRAINT "clothing_items_purchase_url_length" CHECK ("char_length"("purchase_url") <= 2048);

ALTER TABLE "public"."outfits"
    ADD CONSTRAINT "outfits_name_length" CHECK ("char_length"("name") <= 100),
    ADD CONSTRAINT "outfits_description_length" CHECK ("char_length"("description") <= 1000);
