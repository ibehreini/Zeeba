export type OutfitItem = {
  outfit_id: string;
  name: string;
  description: string;
  labels: string[];
  item_ids: string[];
  outfit_img_preview: {
    img: string;
  };
};

export const MyOutfits_Data: OutfitItem[] = [
  {
    outfit_id: '1',
    name: 'Tank and Jeans',
    description: 'Casual fit with black silky tank and midwash jeans',
    labels: ['casual', 'streetwear'],
    item_ids: ['1', '3'],
    outfit_img_preview: {
      img: require('../../assets/images/clothes/outfit_preview.jpg'),
    },
  },
  {
    outfit_id: '2',
    name: 'Red Sweater & Green Skirt',
    description: 'Preppy-chic look combining warm cherry red with forest green flowy skirt',
    labels: ['preppy', 'summer', 'warm'],
    item_ids: ['2', '6'],
    outfit_img_preview: {
      img: require('../../assets/images/clothes/outfit_preview.jpg'),
    },
  },
  {
    outfit_id: '3',
    name: 'Sun Dress with Sneakers',
    description: 'Casual summer look pairing the yellow floral sundress with mint green statement sneakers',
    labels: ['casual', 'summer', 'statement'],
    item_ids: ['4', '5'],
    outfit_img_preview: {
      img: require('../../assets/images/clothes/outfit_preview.jpg'),
    },
  },
  {
    outfit_id: '4',
    name: 'Dressy Night Out',
    description: 'Elegant evening outfit with silky black tank, cat eye sunglasses, and rose gold necklace',
    labels: ['dressy', 'elegant', 'statement'],
    item_ids: ['1', '7', '9'],
    outfit_img_preview: {
      img: require('../../assets/images/clothes/outfit_preview.jpg'),
    },
  },
  {
    outfit_id: '10',
    name: 'Girlie Pink & Tan',
    description: 'Feminine outfit with black tank, pink purse, and gold accents for a chic barbie-inspired look',
    labels: ['girlie', 'dressy', 'feminine'],
    item_ids: ['1', '8', '9'],
    outfit_img_preview: {
      img: require('../../assets/images/clothes/outfit_preview.jpg'),
    },
  },
];