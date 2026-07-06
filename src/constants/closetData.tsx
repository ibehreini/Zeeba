export type ClothingCategory = 'top' | 'bottom' | 'dress' | 'shoes' | 'jacket' | 'bag' | 'accessory';

export type ClothingItemData = {
  id: string;
  category: ClothingCategory;
  img: number;
  name: string;
  description: string;
};

export const Closet_Data: ClothingItemData[] = [
  { id: '1', category: 'top', img: require('../../assets/images/clothes/tank.jpg'), name: 'black tank', description: 'A simple black tank top and because of the silky material its more dressy' },
  { id: '2', category: 'top', img: require('../../assets/images/clothes/top.jpg'), name: 'red sweater', description: 'cherry red warm undertone preppy because of the cut vibe' },
  { id: '3', category: 'bottom', img: require('../../assets/images/clothes/pants.jpg'), name: 'blue jeans', description: 'classic color midwash denium with contrast stitching in white' },
  { id: '6', category: 'bottom', img: require('../../assets/images/clothes/skirt.jpg'), name: 'green maxi skirt', description: 'forest green and material makes it very summer feeling' },
  { id: '5', category: 'shoes', img: require('../../assets/images/clothes/shoes.jpg'), name: 'green sneakers', description: 'white laces mint green definitely statement shoes but not really street wear. only for gym' },
  { id: '4', category: 'dress', img: require('../../assets/images/clothes/dress.jpg'), name: 'sun dress', description: 'yellow floral pattern also has some sky blue and orange in it. Small print and flowy makes it very casual' },
  { id: '8', category: 'bag', img: require('../../assets/images/clothes/accessories.jpg'), name: 'pink purse', description: 'gold hardware and  baby pink like barbie and  very girlie' },
  { id: '7', category: 'accessory', img: require('../../assets/images/clothes/sunglasses.jpg'), name: 'cat eye sunglasses', description: 'black with gold accents' },
  { id: '9', category: 'accessory', img: require('../../assets/images/clothes/necklace.jpg'), name: 'gold heart necklace', description: 'more of a rose gold' },
];
