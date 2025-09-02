import { Global, Module } from '@nestjs/common';
import { ConnectionPoolService } from './connection-pool.service';
import { HttpController } from './http.controller';

@Global()
@Module({
  controllers: [HttpController],
  providers: [ConnectionPoolService],
  exports: [ConnectionPoolService],
})
export class HttpModule {}
