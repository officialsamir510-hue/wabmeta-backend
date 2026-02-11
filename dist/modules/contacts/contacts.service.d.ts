import { CreateContactInput, UpdateContactInput, ImportContactsInput, BulkUpdateContactsInput, ContactsQueryInput, ContactResponse, ContactWithGroups, ContactsListResponse, ImportContactsResponse, ContactStats, CreateContactGroupInput, UpdateContactGroupInput, ContactGroupResponse } from './contacts.types';
export declare class ContactsService {
    create(organizationId: string, input: CreateContactInput): Promise<ContactResponse>;
    getList(organizationId: string, query: ContactsQueryInput): Promise<ContactsListResponse>;
    getById(organizationId: string, contactId: string): Promise<ContactWithGroups>;
    update(organizationId: string, contactId: string, input: UpdateContactInput): Promise<ContactResponse>;
    delete(organizationId: string, contactId: string): Promise<{
        message: string;
    }>;
    /**
     * Import contacts in bulk (single DB query + optional group add)
     * Prevents Prisma pool timeout with efficient batch processing
     */
    import(organizationId: string, input: ImportContactsInput): Promise<ImportContactsResponse>;
    bulkUpdate(organizationId: string, input: BulkUpdateContactsInput): Promise<{
        message: string;
        updated: number;
    }>;
    bulkDelete(organizationId: string, contactIds: string[]): Promise<{
        message: string;
        deleted: number;
    }>;
    getStats(organizationId: string): Promise<ContactStats>;
    getAllTags(organizationId: string): Promise<{
        tag: string;
        count: number;
    }[]>;
    export(organizationId: string, groupId?: string): Promise<any[]>;
    createGroup(organizationId: string, input: CreateContactGroupInput): Promise<ContactGroupResponse>;
    getGroups(organizationId: string): Promise<ContactGroupResponse[]>;
    getGroupById(organizationId: string, groupId: string): Promise<ContactGroupResponse & {
        contacts: ContactResponse[];
    }>;
    updateGroup(organizationId: string, groupId: string, input: UpdateContactGroupInput): Promise<ContactGroupResponse>;
    deleteGroup(organizationId: string, groupId: string): Promise<{
        message: string;
    }>;
    addContactsToGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{
        message: string;
        added: number;
    }>;
    removeContactsFromGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{
        message: string;
        removed: number;
    }>;
    getGroupContacts(organizationId: string, groupId: string, query: ContactsQueryInput): Promise<ContactsListResponse>;
}
export declare const contactsService: ContactsService;
//# sourceMappingURL=contacts.service.d.ts.map