import { Template, CreateTemplatePayload, UpdateTemplatePayload, TemplateRole } from '../../types';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * Application service for Template operations.
 */
export class TemplateService {
  constructor(
    private templateRepo: ITemplateRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Get a template by ID.
   */
  async getTemplate(id: string): Promise<Template> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new NotFoundError('Template', id);
    }
    return template;
  }

  /**
   * Get template by role.
   */
  async getTemplateByRole(role: TemplateRole): Promise<Template> {
    const template = await this.templateRepo.findByRole(role);
    if (!template) {
      throw new NotFoundError('Template', `role:${role}`);
    }
    return template;
  }

  /**
   * List all templates.
   */
  async listTemplates(): Promise<Template[]> {
    return this.templateRepo.findAll();
  }

  /**
   * Create a new template.
   */
  async createTemplate(input: CreateTemplatePayload): Promise<Template> {
    const template = await this.templateRepo.create(input);
    await this.eventBus.emit('template:created', { template });
    return template;
  }

  /**
   * Update a template.
   */
  async updateTemplate(id: string, updates: UpdateTemplatePayload): Promise<Template> {
    const template = await this.templateRepo.update(id, updates);
    await this.eventBus.emit('template:updated', { template });
    return template;
  }

  /**
   * Delete a template.
   */
  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepo.delete(id);
    await this.eventBus.emit('template:deleted', { id });
  }

  /**
   * Reset a template to its default content.
   */
  async resetTemplate(id: string): Promise<Template> {
    const template = await this.templateRepo.resetToDefault(id);
    await this.eventBus.emit('template:reset', { template });
    return template;
  }

  /**
   * Get default template content for a role.
   */
  getDefaultContent(role: TemplateRole): string {
    return this.templateRepo.getDefaultContent(role);
  }
}
