export type ClosetItemData = {
  id: string;
  img: number;
  name: string;
  description: string;
};

export type ClosetSection = {
  title: string;
  data: ClosetItemData[];
};

export const Closet_Data: ClosetSection[] = [
  {
    title: "Tops",
    data: [
      { id: '1', img: require('../../assets/images/clothes/tank.jpg'), name: 'black tank', description: 'A simple black tank top and because of the silky material its more dressy', },
      { id: '2', img: require('../../assets/images/clothes/top.jpg'), name: 'red sweater', description: 'cherry red warm undertone preppy because of the cut vibe' },
    ],
  },
  {
    title: "Bottoms",
    data: [
      { id: '3', img: require('../../assets/images/clothes/pants.jpg'), name: 'blue jeans', description: 'classic color midwash denium with contrast stitching in white' },
      { id: '6', img: require('../../assets/images/clothes/skirt.jpg'), name: 'green maxi skirt', description: 'forest green and material makes it very summer feeling' },
    ],
  },
  {
    title: "Shoes",
    data: [
      { id: '5', img: require('../../assets/images/clothes/shoes.jpg'), name: 'green sneakers', description: 'white laces mint green definitely statement shoes but not really street wear. only for gym' },
    ],
  },
  {
    title: "Dresses",
    data: [
      { id: '4', img: require('../../assets/images/clothes/dress.jpg'), name: 'sun dress', description: 'yellow floral pattern also has some sky blue and orange in it. Small print and flowy makes it very casual' },
    ],
  },
  {
    title: "Accessories",
    data: [
      { id: '7', img: require('../../assets/images/clothes/sunglasses.jpg'), name: 'cat eye sunglasses', description: 'black with gold accents' },
      { id: '8', img: require('../../assets/images/clothes/accessories.jpg'), name: 'pink purse', description: 'gold hardware and  baby pink like barbie and  very girlie' },
      { id: '9', img: require('../../assets/images/clothes/necklace.jpg'), name: 'gold heart necklace', description: 'more of a rose gold' },
    ],
  },
];