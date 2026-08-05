export type SearchContentType='artist'|'album'|'song'|'video'|'news'|'playlist';
export type SearchDocument={id:string;type:SearchContentType;title:string;subtitle:string;description:string;url:string;image:string;artistId?:string;artistName?:string;genre?:string;mood?:string;year?:number;releaseDate?:string;popularity:number;tokens:string[];status:'published';updatedAt:string};
export type SearchFilters={types?:SearchContentType[];genre?:string;artistId?:string;year?:number;mood?:string};
export type SearchRequest={query:string;filters?:SearchFilters;limit?:number;autocomplete?:boolean};
export type SearchHit=SearchDocument&{score:number;matchedTerms:string[]};
export type SearchResponse={query:string;hits:SearchHit[];total:number;facets:{types:Record<string,number>;genres:Record<string,number>;artists:Record<string,number>;years:Record<string,number>};suggestions:string[];provider:string};
export interface SearchProvider{search(input:SearchRequest):Promise<SearchResponse>;upsert(documents:SearchDocument[]):Promise<void>;remove(ids:string[]):Promise<void>;clear():Promise<void>}
