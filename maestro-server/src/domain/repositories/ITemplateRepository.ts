import { Template, CreateTemplatePayload, UpdateTemplatePayload, TemplateRole } from '../../types';

/**
 * Repository interface for Template entities.
 */
export interface ITemplateRepository {
  /**
   * Initialize the repository.
   */
  initialize(): Promise<void>;

  /**
   * Find a template by ID.
   */
  findById(id: string): Promise<Template | null>;

  /**
   * Find template by role (returns the active template for that role).
   */
  findByRole(role: TemplateRole): Promise<Template | null>;

  /**
   * Find all templates.
   */
  findAll(): Promise<Template[]>;

  /**
   * Create a new template.
   */
  create(input: CreateTemplatePayload): Promise<Template>;

  /**
   * Update an existing template.
   */
  update(id: string, updates: UpdateTemplatePayload): Promise<Template>;

  /**
   * Delete a template.
   */
  delete(id: string): Promise<void>;

  /**
   * Reset a template to its default content.
   */
  resetToDefault(id: string): Promise<Template>;

  /**
   * Get the default template content for a role.
   */
  getDefaultContent(role: TemplateRole): string;
}
