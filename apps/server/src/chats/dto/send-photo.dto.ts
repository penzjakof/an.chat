import { IsNumber, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class SendPhotoDto {
  @IsNumber()
  idProfile: number;

  @IsNumber()
  idRegularUser: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsNumber({}, { each: true })
  photoIds: number[];
}

