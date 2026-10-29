import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/request-context.js';
import { contentDisposition, LocalStorageService, StorageService } from './storage.service.js';

/**
 * Téléchargement par lien signé (stockage local uniquement). Route publique comme
 * une URL présignée S3 : la signature et l'expiration tiennent lieu d'autorisation.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response): Promise<void> {
    if (!(this.storage instanceof LocalStorageService)) throw new NotFoundException();
    const file = this.storage.verify(token);
    let body: Buffer;
    try {
      body = await this.storage.read(file.key);
    } catch {
      throw new NotFoundException('Fichier introuvable.');
    }
    res
      .status(200)
      .set({
        'Content-Type': file.contentType,
        'Content-Disposition': contentDisposition(file.fileName),
        'Content-Length': String(body.length),
        'Cache-Control': 'private, no-store',
      })
      .send(body);
  }
}
