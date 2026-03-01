export interface Album {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  size: number;
  isPublic: boolean;
  ownerId: string;
  ownerName?: string;
  pictureCount: number;
  coverPictureId?: string;
}
