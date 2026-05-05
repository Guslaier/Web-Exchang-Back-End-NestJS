import { Controller , UseGuards , Put, Param, Body } from "@nestjs/common";
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator'; 
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PutShiftBody } from './dto/report.dto'

@Controller('reports') 
export class ReportsController {

    @UseGuards(JwtAuthGuard , RolesGuard)
    @Roles('ADMIN' , 'MANAGER')
    @Put('shift/')
    PutShift(@CurrentUser() user : any , @Param() param : any , @Body() body : PutShiftBody) {

    }

}