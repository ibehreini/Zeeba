export type ClothingCategory = 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory';

export type ClothingLabel = 'basics' | 'summery' | 'formal' | 'wintery';

export type ClothingItemData = {
  id: string;
  img: number;
  name: string;
  description: string;
  labels: ClothingLabel[];
};

export type ClosetSection = {
  title: string;
  category: ClothingCategory;
  data: ClothingItemData[];
};

export const Closet_Data: ClosetSection[] = [
  {
    title: "Tops",
    category: 'top',
    data: [
      { id: '1', img: require('../../assets/images/clothes/tank.jpg'), name: 'black tank', description: 'A simple black tank top and because of the silky material its more dressy', labels: ['basics', 'formal'] },
      { id: '2', img: require('../../assets/images/clothes/top.jpg'), name: 'red sweater', description: 'cherry red warm undertone preppy because of the cut vibe', labels: ['wintery', 'formal'] },
    ],
  },
  {
    title: "Bottoms",
    category: 'bottom',
    data: [
      { id: '3', img: require('../../assets/images/clothes/pants.jpg'), name: 'blue jeans', description: 'classic color midwash denium with contrast stitching in white', labels: ['basics'] },
      { id: '6', img: require('../../assets/images/clothes/skirt.jpg'), name: 'green maxi skirt', description: 'forest green and material makes it very summer feeling', labels: ['summery'] },
    ],
  },
  {
    title: "Shoes",
    category: 'shoes',
    data: [
      { id: '5', img: require('../../assets/images/clothes/shoes.jpg'), name: 'green sneakers', description: 'white laces mint green definitely statement shoes but not really street wear. only for gym', labels: ['summery', 'basics'] },
    ],
  },
  {
    title: "Dresses",
    category: 'dress',
    data: [
      { id: '4', img: require('../../assets/images/clothes/dress.jpg'), name: 'sun dress', description: 'yellow floral pattern also has some sky blue and orange in it. Small print and flowy makes it very casual', labels: ['summery'] },
    ],
  },
  {
    title: "Accessories",
    category: 'accessory',
    data: [
      { id: '7', img: require('../../assets/images/clothes/sunglasses.jpg'), name: 'cat eye sunglasses', description: 'black with gold accents', labels: ['summery', 'formal'] },
      { id: '8', img: require('../../assets/images/clothes/accessories.jpg'), name: 'pink purse', description: 'gold hardware and  baby pink like barbie and  very girlie', labels: ['formal'] },
      { id: '9', img: require('../../assets/images/clothes/necklace.jpg'), name: 'gold heart necklace', description: 'more of a rose gold', labels: ['formal', 'wintery'] },
    ],
  },
];

export type ClothingItemWithCategory = ClothingItemData & { category: ClothingCategory };

/** Flat lookup of every clothing item by id, each tagged with its category. */
export const ClothingItemMap: Record<string, ClothingItemWithCategory> = Closet_Data.reduce(
  (map, section) => {
    section.data.forEach(item => {
      map[item.id] = { ...item, category: section.category };
    });
    return map;
  },
  {} as Record<string, ClothingItemWithCategory>,
);
