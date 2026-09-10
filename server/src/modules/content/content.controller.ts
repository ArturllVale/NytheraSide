import { ContentService } from './content.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export class ContentController {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  // POST /admin/content/import
  async importContent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const payload = request.body as Record<string, any>;
      const result = await this.contentService.importDraft(payload);
      reply.send({ success: true, data: result });
    } catch (error) {
      request.log.error(error, 'Error importing content:');
      reply.status(500).send({ success: false, error: (error as Error).message });
    }
  }

  // POST /admin/content/publish
  async publishContent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.contentService.publishLatestDraft();
      reply.send({ success: true, data: result });
    } catch (error) {
      request.log.error(error, 'Error publishing content:');
      reply.status(500).send({ success: false, error: (error as Error).message });
    }
  }

  // GET /admin/content/active
  async getActiveContent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.contentService.getActiveContent();
      reply.send({ success: true, data: result });
    } catch (error) {
      request.log.error(error, 'Error getting active content:');
      reply.status(500).send({ success: false, error: (error as Error).message });
    }
  }

  // GET /content/version (Public)
  async getActiveVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.contentService.getActiveContent();
      reply.send({ success: true, version: result.version });
    } catch (error) {
      request.log.error(error, 'Error getting active content version:');
      reply.status(500).send({ success: false, error: (error as Error).message });
    }
  }


}
