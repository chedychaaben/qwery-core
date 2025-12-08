'use client';

import { useMemo, useState, useCallback } from 'react';
import { Database, ChevronsUpDown } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../shadcn/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../shadcn/popover';
import { Button } from '../../shadcn/button';
import { Skeleton } from '../../shadcn/skeleton';
import { Checkbox } from '../../shadcn/checkbox';
import { cn } from '../../lib/utils';

export interface DatasourceItem {
  id: string;
  name: string;
  slug: string;
  datasource_provider: string;
}

export interface DatasourceSelectorProps {
  selectedDatasources: string[]; // Array of datasource IDs
  onSelectionChange: (datasourceIds: string[]) => void;
  datasources: DatasourceItem[];
  pluginLogoMap: Map<string, string>; // Maps datasource_provider to icon URL
  isLoading?: boolean;
  searchPlaceholder?: string;
}

const MAX_VISIBLE_ITEMS = 10;

export function DatasourceSelector({
  selectedDatasources,
  onSelectionChange,
  datasources,
  pluginLogoMap,
  isLoading = false,
  searchPlaceholder = 'Search datasources...',
}: DatasourceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const filteredDatasources = useMemo(() => {
    if (!search.trim()) {
      return datasources;
    }
    const query = search.toLowerCase();
    return datasources.filter(
      (ds) =>
        ds.name.toLowerCase().includes(query) ||
        ds.slug.toLowerCase().includes(query) ||
        ds.datasource_provider.toLowerCase().includes(query),
    );
  }, [datasources, search]);

  const visibleItems = filteredDatasources.slice(0, MAX_VISIBLE_ITEMS);

  const handleImageError = useCallback((datasourceId: string) => {
    setFailedImages((prev) => new Set(prev).add(datasourceId));
  }, []);

  const handleToggle = (datasourceId: string) => {
    const isSelected = selectedDatasources.includes(datasourceId);
    if (isSelected) {
      onSelectionChange(
        selectedDatasources.filter((id) => id !== datasourceId),
      );
    } else {
      onSelectionChange([...selectedDatasources, datasourceId]);
    }
  };

  // Get display info based on selection
  const displayInfo = useMemo(() => {
    if (selectedDatasources.length === 0) {
      return {
        type: 'empty' as const,
        label: 'Select datasources',
      };
    }

    if (selectedDatasources.length === 1) {
      const selected = datasources.find(
        (ds) => ds.id === selectedDatasources[0],
      );
      if (selected) {
        const icon = pluginLogoMap.get(selected.datasource_provider);
        return {
          type: 'single' as const,
          label: selected.name,
          icon,
        };
      }
    }

    return {
      type: 'multiple' as const,
      count: selectedDatasources.length,
    };
  }, [selectedDatasources, datasources, pluginLogoMap]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-normal"
        >
          {displayInfo.type === 'empty' && (
            <>
              <Database className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground">{displayInfo.label}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </>
          )}

          {displayInfo.type === 'single' && (
            <>
              {displayInfo.icon &&
              !failedImages.has(selectedDatasources[0] ?? '') ? (
                <img
                  src={displayInfo.icon}
                  alt={displayInfo.label}
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                  onError={() => {
                    if (selectedDatasources[0]) {
                      handleImageError(selectedDatasources[0]);
                    }
                  }}
                />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              <span className="truncate">{displayInfo.label}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </>
          )}

          {displayInfo.type === 'multiple' && (
            <>
              <Database className="h-3.5 w-3.5 text-green-600" />
              <span className="truncate">x {displayInfo.count}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[101] w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="mt-2 h-8 w-full" />
                <Skeleton className="mt-2 h-8 w-full" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <span className="text-muted-foreground text-sm">
                    No datasources found
                  </span>
                </CommandEmpty>
                {visibleItems.length > 0 && (
                  <CommandGroup>
                    {visibleItems.map((datasource) => {
                      const isSelected = selectedDatasources.includes(
                        datasource.id,
                      );
                      const icon = pluginLogoMap.get(
                        datasource.datasource_provider,
                      );
                      const hasFailed = failedImages.has(datasource.id);
                      const showIcon = icon && !hasFailed;

                      return (
                        <CommandItem
                          key={datasource.id}
                          onSelect={() => handleToggle(datasource.id)}
                          className={cn(
                            'cursor-pointer',
                            isSelected && 'bg-accent text-accent-foreground',
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="mr-2"
                            onCheckedChange={() => handleToggle(datasource.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {showIcon ? (
                            <img
                              src={icon}
                              alt={datasource.name}
                              className="mr-2 h-4 w-4 shrink-0 object-contain"
                              onError={() => handleImageError(datasource.id)}
                            />
                          ) : (
                            <Database className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">{datasource.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                {filteredDatasources.length > MAX_VISIBLE_ITEMS && (
                  <div className="border-t p-2 text-center">
                    <span className="text-muted-foreground text-xs">
                      Showing {MAX_VISIBLE_ITEMS} of{' '}
                      {filteredDatasources.length} datasources
                    </span>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
